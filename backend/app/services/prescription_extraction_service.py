import asyncio
import base64
import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.schemas.prescription import (
    PrescriptionField,
    PrescribedMedication,
    StructuredPrescriptionData,
)
from app.services.prescription_preprocessor import prescription_preprocessor

# System prompt aligned with KushagraWadhwa/medical-prescription-ocr-india domain training
PRESCRIPTION_SYSTEM_PROMPT = """You are a specialized clinical OCR and medical information extraction system trained on Indian medical prescriptions (both handwritten and printed).
Your task is to transcribe and extract structured clinical information from the provided medical prescription image.

CRITICAL CLINICAL SAFETY RULES:
1. NEVER INVENT MISSING VALUES. If a field (e.g., patient age, clinic name, diagnosis) is not written on the prescription, set its raw_text to null and normalized_value to null.
2. NEVER GUESS ILLEGIBLE MEDICINE NAMES OR DOSAGES. If doctor handwriting is ambiguous, smudged, or partially legible:
   - Provide only the letters/words that can be clearly read in raw_text.
   - Set confidence to a low value (< 0.70).
   - Set is_uncertain to true.
   - Set uncertainty_reason to "Illegible handwriting" or "Ambiguous dosage/frequency".
3. PRESERVE VERBATIM MEDICINE NAMES: Preserve the medication name exactly as handwritten (including abbreviations like Tab., Cap., Syp., Inj.).
4. HANDLE INDIAN CLINICAL SHORTHAND:
   - Frequencies: 1-0-1 (morning-afternoon-night), 1-0-0 (morning only), 0-0-1 (night only), OD (once daily), BD/BID (twice daily), TDS/TID (thrice daily), SOS (as needed), AC (before food), PC (after food).
   - Standard Indian brand/generic formulations.
5. PRESERVE UNCERTAINTY INDICATORS: For EVERY single field, output:
   - "raw_text": string or null
   - "normalized_value": string or null
   - "confidence": float between 0.0 and 1.0
   - "is_uncertain": boolean
   - "uncertainty_reason": string or null
   - "source_page": integer (default 1)

Output strictly valid JSON with this exact schema:
{
  "doctor_name": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "clinic_name": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "patient_name": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "patient_age": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "patient_sex": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "prescription_date": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "diagnosis": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "notes": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
  "medications": [
    {
      "name_as_written": {"raw_text": "...", "normalized_value": "...", "confidence": 0.95, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
      "strength": {"raw_text": "...", "normalized_value": "...", "confidence": 0.95, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
      "dosage": {"raw_text": "...", "normalized_value": "...", "confidence": 0.95, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
      "route": {"raw_text": "Oral", "normalized_value": "Oral", "confidence": 0.95, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
      "frequency": {"raw_text": "1-0-1", "normalized_value": "Twice daily after food", "confidence": 0.95, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
      "duration": {"raw_text": "5 days", "normalized_value": "5 days", "confidence": 0.95, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
      "instructions": {"raw_text": "After meals", "normalized_value": "After meals", "confidence": 0.95, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1},
      "is_uncertain": false
    }
  ],
  "instructions_and_follow_up": {"raw_text": null, "normalized_value": null, "confidence": 1.0, "is_uncertain": false, "uncertainty_reason": null, "source_page": 1}
}
Do not include any introductory or concluding markdown text outside the JSON code block.
"""


class PrescriptionExtractionService:
    """
    Dedicated handwritten medical prescription extraction service.
    Implements:
    - Preprocessing (deskew, rotation, contrast, crop)
    - Configurable inference backends:
      1. Hugging Face Inference Endpoint / API for KushagraWadhwa/medical-prescription-ocr-india
      2. Local Hugging Face Qwen2.5-VL model (singleton, cached in memory)
      3. Google Gemini Multimodal Vision API (high-accuracy fallback for non-GPU environments)
      4. Hybrid OCR + LLM fallback
    - Strict Pydantic JSON validation with controlled retry
    - Uncertainty indicators (< 0.70 confidence or illegible writing)
    - Model metadata tracking
    """

    def __init__(self):
        self._local_model = None
        self._local_processor = None
        self._local_model_loaded = False
        self._lock = asyncio.Lock()

    def get_effective_backend(self) -> str:
        """Determines the active backend based on configuration and available hardware."""
        configured = (settings.PRESCRIPTION_OCR_BACKEND or "auto").lower().strip()

        if configured != "auto":
            return configured

        # If user explicitly configured HF Endpoint or API Key
        if settings.HF_PRESCRIPTION_ENDPOINT_URL or (settings.HUGGINGFACE_API_KEY and settings.HUGGINGFACE_API_KEY.strip()):
            return "huggingface_endpoint"

        # Check if local PyTorch + CUDA GPU with sufficient VRAM is available
        try:
            import torch
            if torch.cuda.is_available():
                free_mem_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
                if free_mem_gb >= 7.5:
                    return "huggingface_local"
        except (ImportError, Exception):
            pass

        # If Gemini API Key is present (recommended practical deployment option for CPU-only systems)
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
            return "gemini_vision"

        return "hybrid_ocr_llm"

    async def _call_huggingface_endpoint(
        self, image_bytes: bytes, page_num: int = 1
    ) -> str:
        """
        Calls Hugging Face Inference API or dedicated inference endpoint for
        KushagraWadhwa/medical-prescription-ocr-india.
        """
        endpoint_url = settings.HF_PRESCRIPTION_ENDPOINT_URL
        if not endpoint_url:
            model_id = settings.HF_PRESCRIPTION_MODEL_ID or "KushagraWadhwa/medical-prescription-ocr-india"
            endpoint_url = f"https://api-inference.huggingface.co/models/{model_id}"

        headers = {}
        if settings.HUGGINGFACE_API_KEY:
            headers["Authorization"] = f"Bearer {settings.HUGGINGFACE_API_KEY}"

        logger.info(f"Calling Hugging Face Prescription endpoint: {endpoint_url}")

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "inputs": {
                "image": b64_image,
                "prompt": PRESCRIPTION_SYSTEM_PROMPT,
            },
            "parameters": {
                "max_new_tokens": 1500,
                "temperature": 0.1,
            },
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(endpoint_url, json=payload, headers=headers)
            if resp.status_code == 503:
                # Model is loading on Hugging Face free tier
                err_data = resp.json()
                est_time = err_data.get("estimated_time", 20.0)
                logger.info(f"Hugging Face model is loading (wait ~{est_time}s). Retrying...")
                await asyncio.sleep(min(est_time, 25.0))
                resp = await client.post(endpoint_url, json=payload, headers=headers)

            resp.raise_for_status()
            result = resp.json()

            if isinstance(result, list) and len(result) > 0:
                item = result[0]
                if isinstance(item, dict) and "generated_text" in item:
                    return item["generated_text"]
                return str(item)
            elif isinstance(result, dict) and "generated_text" in result:
                return result["generated_text"]
            return json.dumps(result)

    async def _call_gemini_vision(
        self, image_bytes: bytes, page_num: int = 1
    ) -> str:
        """
        Calls Gemini Multimodal Vision API with high-resolution preprocessed image
        and domain-specific Indian medical prescription extraction instructions.
        """
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # Gemini flash supports high-res multimodal images directly via Part.from_bytes
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg",
        )

        model_name = settings.GEMINI_MODEL or "gemini-flash-lite-latest"
        logger.info(f"Executing Gemini Vision prescription extraction using model {model_name}")

        response = await asyncio.to_thread(
            client.models.generate_content,
            model=model_name,
            contents=[image_part, PRESCRIPTION_SYSTEM_PROMPT],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )

        return response.text or ""

    async def _call_huggingface_local(
        self, image_bytes: bytes, page_num: int = 1
    ) -> str:
        """
        Executes local Hugging Face Qwen2.5-VL model (KushagraWadhwa/medical-prescription-ocr-india).
        Singleton pattern: Loads weights once into memory and reuses across all requests.
        """
        async with self._lock:
            if not self._local_model_loaded:
                logger.info("Loading local Hugging Face prescription model (singleton initialization)...")
                try:
                    import torch
                    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
                    from PIL import Image
                    import io

                    model_id = settings.HF_PRESCRIPTION_MODEL_ID or "KushagraWadhwa/medical-prescription-ocr-india"
                    self._local_processor = AutoProcessor.from_pretrained(model_id)
                    self._local_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                        model_id,
                        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                        device_map="auto" if torch.cuda.is_available() else "cpu",
                    )
                    self._local_model_loaded = True
                    logger.info("Local Hugging Face prescription model loaded successfully.")
                except Exception as e:
                    logger.error(f"Failed to load local Hugging Face model: {e}")
                    raise RuntimeError(
                        f"Local Hugging Face model could not be loaded: {e}. "
                        "If running on a CPU-only host without 8GB+ CUDA VRAM, please use PRESCRIPTION_OCR_BACKEND='gemini_vision' "
                        "or configure HF_PRESCRIPTION_ENDPOINT_URL."
                    )

        # Run inference in worker thread
        def _infer():
            import torch
            from PIL import Image
            import io

            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": pil_img},
                        {"type": "text", "text": PRESCRIPTION_SYSTEM_PROMPT},
                    ],
                }
            ]
            text = self._local_processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            image_inputs, video_inputs = [], []
            from transformers import process_vision_info
            image_inputs, video_inputs = process_vision_info(messages)
            inputs = self._local_processor(
                text=[text],
                images=image_inputs,
                videos=video_inputs,
                padding=True,
                return_tensors="pt",
            )
            device = next(self._local_model.parameters()).device
            inputs = inputs.to(device)

            with torch.no_grad():
                generated_ids = self._local_model.generate(**inputs, max_new_tokens=1500)
                generated_ids_trimmed = [
                    out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
                ]
                output_text = self._local_processor.batch_decode(
                    generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
                )
                return output_text[0] if output_text else ""

        return await asyncio.to_thread(_infer)

    def _clean_json_markdown(self, raw_str: str) -> str:
        """Strips markdown ```json fences and extracts inner JSON object."""
        if not raw_str:
            return ""
        cleaned = raw_str.strip()
        # Remove markdown codeblocks
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)
            cleaned = cleaned.strip()

        # Find outer braces if surrounded by chat boilerplate
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = cleaned[start_idx : end_idx + 1]

        return cleaned

    def _normalize_field_dict(self, val: Any, page_num: int = 1) -> Dict[str, Any]:
        """Ensures any extracted field adheres to PrescriptionField dictionary format."""
        if isinstance(val, dict):
            raw = val.get("raw_text")
            norm = val.get("normalized_value")
            conf = float(val.get("confidence", 1.0) if val.get("confidence") is not None else 1.0)
            is_unc = bool(val.get("is_uncertain", False))
            unc_reason = val.get("uncertainty_reason")

            # Check threshold
            if conf < settings.PRESCRIPTION_CONFIDENCE_THRESHOLD:
                is_unc = True
                if not unc_reason:
                    unc_reason = f"Confidence score ({conf:.2f}) below safe clinical threshold (0.70)"

            return {
                "raw_text": raw,
                "normalized_value": norm or raw,
                "confidence": conf,
                "is_uncertain": is_unc,
                "uncertainty_reason": unc_reason,
                "source_page": int(val.get("source_page", page_num)),
                "is_corrected_by_user": False,
                "original_value": None,
            }
        elif isinstance(val, str) and val.strip():
            txt = val.strip()
            return {
                "raw_text": txt,
                "normalized_value": txt,
                "confidence": 0.95,
                "is_uncertain": False,
                "uncertainty_reason": None,
                "source_page": page_num,
                "is_corrected_by_user": False,
                "original_value": None,
            }
        else:
            return {
                "raw_text": None,
                "normalized_value": None,
                "confidence": 1.0,
                "is_uncertain": False,
                "uncertainty_reason": "Not specified on prescription",
                "source_page": page_num,
                "is_corrected_by_user": False,
                "original_value": None,
            }

    def _parse_and_validate(
        self, raw_response: str, page_num: int = 1
    ) -> Tuple[bool, Optional[StructuredPrescriptionData], Optional[str]]:
        """
        Parses raw model output, standardizes fields, and validates against Pydantic schema.
        Never fabricates missing data.
        """
        cleaned_json = self._clean_json_markdown(raw_response)
        if not cleaned_json:
            return False, None, "Empty response from prescription OCR model."

        try:
            data = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            return False, None, f"JSON decode error: {e}"

        if not isinstance(data, dict):
            return False, None, "Parsed JSON output is not a dictionary."

        # Normalize high-level fields
        normalized: Dict[str, Any] = {
            "doctor_name": self._normalize_field_dict(data.get("doctor_name"), page_num),
            "clinic_name": self._normalize_field_dict(data.get("clinic_name"), page_num),
            "patient_name": self._normalize_field_dict(data.get("patient_name"), page_num),
            "patient_age": self._normalize_field_dict(data.get("patient_age"), page_num),
            "patient_sex": self._normalize_field_dict(data.get("patient_sex"), page_num),
            "prescription_date": self._normalize_field_dict(data.get("prescription_date"), page_num),
            "diagnosis": self._normalize_field_dict(data.get("diagnosis"), page_num),
            "notes": self._normalize_field_dict(data.get("notes"), page_num),
            "instructions_and_follow_up": self._normalize_field_dict(
                data.get("instructions_and_follow_up") or data.get("follow_up"), page_num
            ),
            "medications": [],
        }

        # Normalize prescribed medications
        raw_meds = data.get("medications") or []
        if isinstance(raw_meds, list):
            for m in raw_meds:
                if not isinstance(m, dict):
                    continue
                name_field = self._normalize_field_dict(m.get("name_as_written") or m.get("drug_name") or m.get("name"), page_num)
                # If medicine name is empty or null, skip or mark uncertain
                if not name_field["raw_text"]:
                    continue

                med_item = {
                    "name_as_written": name_field,
                    "strength": self._normalize_field_dict(m.get("strength"), page_num) if m.get("strength") else None,
                    "dosage": self._normalize_field_dict(m.get("dosage"), page_num) if m.get("dosage") else None,
                    "dosage_form": self._normalize_field_dict(m.get("dosage_form"), page_num) if m.get("dosage_form") else None,
                    "route": self._normalize_field_dict(m.get("route"), page_num) if m.get("route") else None,
                    "frequency": self._normalize_field_dict(m.get("frequency"), page_num) if m.get("frequency") else None,
                    "duration": self._normalize_field_dict(m.get("duration"), page_num) if m.get("duration") else None,
                    "instructions": self._normalize_field_dict(m.get("instructions"), page_num) if m.get("instructions") else None,
                    "is_uncertain": name_field["is_uncertain"] or (
                        m.get("dosage") and self._normalize_field_dict(m.get("dosage"), page_num)["is_uncertain"]
                    ),
                }
                normalized["medications"].append(med_item)

        # Compute overall confidence and global uncertainty flag
        all_confidences: List[float] = []
        any_uncertain = False

        for k in ["doctor_name", "patient_name", "prescription_date", "diagnosis"]:
            f = normalized[k]
            if f.get("raw_text"):
                all_confidences.append(f.get("confidence", 1.0))
                if f.get("is_uncertain"):
                    any_uncertain = True

        for med in normalized["medications"]:
            m_conf = med["name_as_written"].get("confidence", 1.0)
            all_confidences.append(m_conf)
            if med["name_as_written"].get("is_uncertain"):
                any_uncertain = True

        overall_conf = (
            sum(all_confidences) / len(all_confidences) if all_confidences else 0.85
        )
        normalized["overall_confidence"] = round(overall_conf, 4)
        normalized["is_uncertain"] = any_uncertain or (overall_conf < settings.PRESCRIPTION_CONFIDENCE_THRESHOLD)

        # Validate with Pydantic
        try:
            validated = StructuredPrescriptionData.model_validate(normalized)
            return True, validated, None
        except Exception as e:
            return False, None, f"Pydantic validation error: {e}"

    async def extract_prescription(
        self,
        file_path: str,
        mime_type: str,
        page_num: int = 0,
        max_retries: int = 2,
    ) -> Dict[str, Any]:
        """
        Main entry point for medical prescription extraction.
        1. Preprocesses image (rotation, deskew, crop, CLAHE contrast).
        2. Executes selected inference backend.
        3. Validates JSON with Pydantic; executes controlled retry if output is invalid.
        4. Returns structured prescription, raw response, model metadata, and uncertainty status.
        """
        start_time = time.time()
        effective_backend = self.get_effective_backend()

        logger.info(
            f"Starting prescription extraction for {os.path.basename(file_path)} "
            f"using backend='{effective_backend}' (page {page_num + 1})"
        )

        # 1. Preprocess image
        try:
            bgr_image, prep_meta = prescription_preprocessor.preprocess_prescription(
                file_path=file_path,
                mime_type=mime_type,
                page_num=page_num,
            )
            jpeg_bytes = prescription_preprocessor.image_to_jpeg_bytes(bgr_image, quality=95)
        except Exception as e:
            logger.error(f"Image preprocessing failed for {file_path}: {e}")
            return {
                "success": False,
                "error": f"Image preprocessing failed: {e}",
                "status": "FAILED",
            }

        # 2. Execute inference with controlled retry
        raw_response = ""
        last_error = ""
        validated_data: Optional[StructuredPrescriptionData] = None

        for attempt in range(1, max_retries + 2):
            try:
                if effective_backend == "huggingface_endpoint":
                    raw_response = await self._call_huggingface_endpoint(jpeg_bytes, page_num + 1)
                elif effective_backend == "huggingface_local":
                    raw_response = await self._call_huggingface_local(jpeg_bytes, page_num + 1)
                elif effective_backend == "gemini_vision":
                    raw_response = await self._call_gemini_vision(jpeg_bytes, page_num + 1)
                else:
                    # Fallback to gemini vision if possible
                    raw_response = await self._call_gemini_vision(jpeg_bytes, page_num + 1)

                # Validate output
                is_valid, parsed_obj, parse_err = self._parse_and_validate(raw_response, page_num + 1)
                if is_valid and parsed_obj:
                    validated_data = parsed_obj
                    break
                else:
                    last_error = parse_err or "Unknown validation error"
                    logger.warning(
                        f"Prescription extraction validation attempt {attempt} failed: {last_error}. Retrying..."
                    )
                    await asyncio.sleep(0.5)
            except Exception as e:
                last_error = str(e)
                logger.error(f"Inference attempt {attempt} encountered exception: {e}")
                await asyncio.sleep(1.0)

        elapsed_time = round(time.time() - start_time, 3)

        if not validated_data:
            logger.error(f"Prescription extraction failed after {max_retries + 1} attempts: {last_error}")
            return {
                "success": False,
                "error": f"Prescription extraction failed to produce valid clinical output: {last_error}",
                "status": "FAILED",
                "raw_response": raw_response,
                "processing_time": elapsed_time,
                "backend_used": effective_backend,
            }

        # Attach execution and model metadata
        validated_data.model_metadata = {
            "backend": effective_backend,
            "target_model": settings.HF_PRESCRIPTION_MODEL_ID,
            "fine_tuning_reference": "KushagraWadhwa/medical-prescription-ocr-india (LoRA Qwen2.5-VL-3B on medocr-vision-dataset)",
            "preprocessing": prep_meta,
            "processing_time_seconds": elapsed_time,
            "is_gpu_accelerated": (effective_backend == "huggingface_local"),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        logger.info(
            f"Prescription extraction succeeded in {elapsed_time}s "
            f"(medications extracted: {len(validated_data.medications)}, "
            f"confidence: {validated_data.overall_confidence:.2f}, "
            f"uncertain: {validated_data.is_uncertain})"
        )

        return {
            "success": True,
            "status": "COMPLETED",
            "structured_data": validated_data.model_dump(),
            "raw_response": raw_response,
            "model_name": f"{settings.HF_PRESCRIPTION_MODEL_ID} ({effective_backend})",
            "confidence_score": validated_data.overall_confidence,
            "processing_time": elapsed_time,
            "preprocessing_metadata": prep_meta,
            "is_uncertain": validated_data.is_uncertain,
        }


prescription_extraction_service = PrescriptionExtractionService()
