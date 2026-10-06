import os
import io
import re
import time
import uuid
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image
import fitz  # PyMuPDF
from app.core.logging import logger

os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["FLAGS_use_mkldnn"] = "0"

# Cached singleton OCR engines
_paddle_en_engine = None
_paddle_ta_engine = None
_rapid_ocr_engine = None


def _get_rapid_ocr():
    """
    Safely retrieve RapidOCR (PaddleOCR ONNX Runtime engine).
    Works on all platforms without C++ / oneDNN compatibility issues.
    """
    global _rapid_ocr_engine
    if _rapid_ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR

            logger.info("Initializing RapidOCR (PaddleOCR ONNX runtime)...")
            _rapid_ocr_engine = RapidOCR()
        except Exception as exc:
            logger.warning(f"RapidOCR unavailable: {exc}")
            _rapid_ocr_engine = None
    return _rapid_ocr_engine


def _get_paddle_ocr(lang: str = "en"):
    """
    Safely retrieve native PaddleOCR instance for specified language.
    """
    global _paddle_en_engine, _paddle_ta_engine
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        return None

    try:
        if lang == "ta":
            if _paddle_ta_engine is None:
                logger.info("Initializing PaddleOCR with Tamil language model...")
                _paddle_ta_engine = PaddleOCR(lang="ta")
            return _paddle_ta_engine
        else:
            if _paddle_en_engine is None:
                logger.info("Initializing PaddleOCR with English language model...")
                _paddle_en_engine = PaddleOCR(lang="en")
            return _paddle_en_engine
    except Exception as exc:
        logger.warning(f"PaddleOCR native initialization error (lang={lang}): {exc}")
        return None


def detect_language(text: str) -> str:
    """
    Detect whether text contains English, Tamil, or both.
    Tamil Unicode block is \u0B80 - \u0BFF.
    """
    if not text or not text.strip():
        return "en"

    tamil_matches = re.findall(r"[\u0B80-\u0BFF]", text)
    latin_matches = re.findall(r"[A-Za-z]", text)

    tamil_count = len(tamil_matches)
    latin_count = len(latin_matches)

    if tamil_count >= 5 and latin_count >= 5:
        return "ta, en"
    elif tamil_count >= 3:
        return "ta"
    elif latin_count > 0:
        return "en"
    return "en"


def clean_extracted_text(raw_text: str) -> str:
    """
    Clean and structure raw OCR extracted text.
    - Normalizes strange unicode whitespace.
    - Cleans up excessive blank lines while preserving paragraph and line structure.
    - Trims individual lines.
    """
    if not raw_text:
        return ""

    # Normalize line breaks
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")

    # Normalize multiple spaces and non-breaking spaces
    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        cleaned_line = re.sub(r"[\t\u00a0\u200b]+", " ", line)
        cleaned_line = re.sub(r" {2,}", " ", cleaned_line).strip()
        cleaned_lines.append(cleaned_line)

    # Reconstruct with controlled blank lines (max 1 empty line between content)
    result_lines = []
    prev_blank = False
    for line in cleaned_lines:
        if not line:
            if not prev_blank:
                result_lines.append("")
                prev_blank = True
        else:
            result_lines.append(line)
            prev_blank = False

    return "\n".join(result_lines).strip()


class OCRService:
    """
    Production-ready OCR Pipeline supporting PDF and image formats.
    Integrates PaddleOCR / RapidOCR and PyMuPDF rendering.
    """

    async def process_document(
        self, file_path: str, mime_type: str
    ) -> Dict[str, Any]:
        """
        Executes complete OCR pipeline:
        File -> Render pages -> Run OCR -> Compute confidence -> Clean text -> Result.
        """
        start_time = time.time()

        if not os.path.exists(file_path):
            return {
                "success": False,
                "status": "FAILED",
                "raw_text": "",
                "cleaned_text": "",
                "ocr_confidence": 0.0,
                "page_count": 0,
                "language_detected": "en",
                "processing_time": 0.0,
                "error": "Document file does not exist on disk.",
            }

        try:
            if mime_type == "application/pdf":
                raw_text, confidence, page_count = self._process_pdf(file_path)
            elif mime_type in ["image/jpeg", "image/png", "image/jpg"]:
                raw_text, confidence, page_count = self._process_image(file_path)
            else:
                return {
                    "success": False,
                    "status": "FAILED",
                    "raw_text": "",
                    "cleaned_text": "",
                    "ocr_confidence": 0.0,
                    "page_count": 0,
                    "language_detected": "en",
                    "processing_time": round(time.time() - start_time, 2),
                    "error": f"Unsupported MIME type for OCR: {mime_type}",
                }

            processing_time = round(time.time() - start_time, 2)
            cleaned_text = clean_extracted_text(raw_text)
            language = detect_language(cleaned_text)

            # Determine status based on confidence and content
            if not cleaned_text.strip():
                status = "FAILED"
                error_msg = "No readable text could be extracted from this document."
            elif confidence < 0.40:
                status = "LOW_CONFIDENCE"
                error_msg = None
            else:
                status = "COMPLETED"
                error_msg = None

            return {
                "success": status != "FAILED",
                "status": status,
                "raw_text": raw_text,
                "cleaned_text": cleaned_text,
                "ocr_confidence": round(confidence, 4),
                "page_count": page_count,
                "language_detected": language,
                "processing_time": processing_time,
                "error": error_msg,
            }

        except Exception as exc:
            logger.error(f"OCR Pipeline failed for {file_path}: {exc}", exc_info=True)
            return {
                "success": False,
                "status": "FAILED",
                "raw_text": "",
                "cleaned_text": "",
                "ocr_confidence": 0.0,
                "page_count": 1,
                "language_detected": "en",
                "processing_time": round(time.time() - start_time, 2),
                "error": f"OCR extraction error: {str(exc)}",
            }

    def _process_image(self, image_path: str) -> Tuple[str, float, int]:
        """
        Process single image using PaddleOCR or RapidOCR.
        """
        # 1. Try RapidOCR (PaddleOCR ONNX Runtime engine - high speed & reliability)
        rapid_engine = _get_rapid_ocr()
        if rapid_engine is not None:
            try:
                result, _ = rapid_engine(image_path)
                text, conf = self._parse_rapid_ocr_result(result)
                if text.strip():
                    return text, conf, 1
            except Exception as exc:
                logger.warning(f"RapidOCR failed on image: {exc}")

        # 2. Try native PaddleOCR
        paddle_engine = _get_paddle_ocr("en")
        if paddle_engine is not None:
            text, conf = self._run_paddle_on_image(paddle_engine, image_path)
            if text.strip():
                return text, conf, 1

        logger.warning(f"No OCR engine succeeded on image: {image_path}")
        return "", 0.0, 1

    def _process_pdf(self, pdf_path: str) -> Tuple[str, float, int]:
        """
        Convert PDF pages into images safely with PyMuPDF (fitz) and run OCR.
        Also inspects native digital text layers.
        """
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        if page_count == 0:
            doc.close()
            return "", 0.0, 0

        all_page_texts = []
        confidences = []

        rapid_engine = _get_rapid_ocr()

        for page_idx in range(page_count):
            page = doc[page_idx]
            page_text = ""
            page_conf = 0.0

            # 1. Extract digital native text layer
            native_text = page.get_text("text").strip()

            # 2. Render page to high-res image for OCR
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")

            # Try OCR on rendered page
            ocr_text = ""
            ocr_conf = 0.0

            if rapid_engine is not None:
                try:
                    result, _ = rapid_engine(img_bytes)
                    ocr_text, ocr_conf = self._parse_rapid_ocr_result(result)
                except Exception as exc:
                    logger.warning(f"RapidOCR failed on PDF page {page_idx + 1}: {exc}")

            if not ocr_text.strip():
                paddle_engine = _get_paddle_ocr("en")
                if paddle_engine is not None:
                    try:
                        ocr_text, ocr_conf = self._run_paddle_on_bytes(
                            paddle_engine, img_bytes
                        )
                    except Exception as exc:
                        logger.warning(f"PaddleOCR failed on PDF page {page_idx + 1}: {exc}")

            if ocr_text.strip():
                page_text = ocr_text
                page_conf = ocr_conf
            elif native_text:
                page_text = native_text
                page_conf = 0.95

            header = f"--- Page {page_idx + 1} ---"
            if page_text.strip():
                all_page_texts.append(f"{header}\n{page_text}")
                confidences.append(page_conf)
            else:
                all_page_texts.append(f"{header}\n[No readable text detected]")
                confidences.append(0.0)

        doc.close()

        combined_text = "\n\n".join(all_page_texts)
        avg_confidence = (
            sum(confidences) / len(confidences) if confidences else 0.0
        )

        return combined_text, avg_confidence, page_count

    def _parse_rapid_ocr_result(self, result) -> Tuple[str, float]:
        """
        Parse RapidOCR output format:
        [[[[box], text, score]], ...]
        """
        if not result:
            return "", 0.0

        lines = []
        scores = []

        for item in result:
            if len(item) >= 3:
                txt = str(item[1]).strip()
                score = float(item[2])
                if txt:
                    lines.append(txt)
                    scores.append(score)

        extracted_text = "\n".join(lines)
        avg_score = sum(scores) / len(scores) if scores else 0.0
        return extracted_text, avg_score

    def _run_paddle_on_image(self, ocr_engine, image_path: str) -> Tuple[str, float]:
        """
        Run native PaddleOCR on an image file path.
        """
        try:
            if hasattr(ocr_engine, "predict"):
                output = ocr_engine.predict(image_path)
                return self._parse_paddlex_output(output)
            elif hasattr(ocr_engine, "ocr"):
                result = ocr_engine.ocr(image_path, cls=True)
                return self._parse_paddle_result(result)
            return "", 0.0
        except Exception as exc:
            logger.warning(f"PaddleOCR error on image {image_path}: {exc}")
            return "", 0.0

    def _run_paddle_on_bytes(self, ocr_engine, img_bytes: bytes) -> Tuple[str, float]:
        """
        Run native PaddleOCR on in-memory image bytes.
        """
        try:
            image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            import numpy as np

            img_arr = np.array(image)

            if hasattr(ocr_engine, "predict"):
                output = ocr_engine.predict(img_arr)
                return self._parse_paddlex_output(output)
            elif hasattr(ocr_engine, "ocr"):
                result = ocr_engine.ocr(img_arr, cls=True)
                return self._parse_paddle_result(result)
            return "", 0.0
        except Exception as exc:
            logger.warning(f"PaddleOCR error on image bytes: {exc}")
            return "", 0.0

    def _parse_paddle_result(self, result) -> Tuple[str, float]:
        """
        Parse standard PaddleOCR output format:
        [[[box], (text, score)], ...]
        """
        if not result:
            return "", 0.0

        lines = []
        scores = []

        for page in result:
            if not page:
                continue
            for line_item in page:
                if len(line_item) >= 2:
                    text_info = line_item[1]
                    if isinstance(text_info, (tuple, list)) and len(text_info) >= 2:
                        txt = str(text_info[0]).strip()
                        score = float(text_info[1])
                        if txt:
                            lines.append(txt)
                            scores.append(score)

        extracted_text = "\n".join(lines)
        avg_score = sum(scores) / len(scores) if scores else 0.0
        return extracted_text, avg_score

    def _parse_paddlex_output(self, output) -> Tuple[str, float]:
        """
        Parse PaddleX 3.x pipeline prediction output format.
        """
        if not output:
            return "", 0.0

        lines = []
        scores = []

        for item in output:
            if hasattr(item, "json"):
                data = item.json
                rec_texts = data.get("rec_text", []) or data.get("rec_texts", [])
                rec_scores = data.get("rec_score", []) or data.get("rec_scores", [])
                for t, s in zip(rec_texts, rec_scores):
                    lines.append(str(t))
                    scores.append(float(s))
            elif isinstance(item, dict):
                texts = item.get("rec_texts", [])
                scores_list = item.get("rec_scores", [])
                for t, s in zip(texts, scores_list):
                    lines.append(str(t))
                    scores.append(float(s))

        extracted_text = "\n".join(lines)
        avg_score = sum(scores) / len(scores) if scores else 0.0
        return extracted_text, avg_score


ocr_service = OCRService()
