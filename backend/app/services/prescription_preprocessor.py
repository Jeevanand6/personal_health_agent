import io
import math
import os
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image, ImageOps

from app.core.logging import logger

try:
    import fitz  # PyMuPDF
except ImportError:
    try:
        import pymupdf as fitz
    except ImportError:
        fitz = None


class PrescriptionPreprocessor:
    """
    Medical prescription image and PDF preprocessor.
    Implements rotation correction, deskewing, auto-cropping,
    shadow removal, and contrast enhancement (CLAHE) to maximize OCR
    and VLM recognition accuracy for handwritten doctor prescriptions.
    """

    def __init__(self, target_dpi: int = 300, max_dimension: int = 2400):
        self.target_dpi = target_dpi
        self.max_dimension = max_dimension

    def get_page_count(self, file_path: str, mime_type: str) -> int:
        """Determines total number of pages in document."""
        if "pdf" in mime_type.lower():
            if not fitz:
                return 1
            try:
                with fitz.open(file_path) as doc:
                    return len(doc)
            except Exception as e:
                logger.warning(f"Failed to read PDF page count: {e}")
                return 1
        return 1

    def load_raw_page_image(
        self, file_path: str, mime_type: str, page_num: int = 0
    ) -> Tuple[np.ndarray, int]:
        """
        Loads document page and converts it to a standard BGR numpy array.
        Renders PDF at target DPI (default 300 DPI for medical legibility).
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Prescription file not found at {file_path}")

        total_pages = 1

        if "pdf" in mime_type.lower():
            if not fitz:
                raise RuntimeError("PyMuPDF (fitz) is required to process PDF medical prescriptions.")

            with fitz.open(file_path) as doc:
                total_pages = len(doc)
                if page_num < 0 or page_num >= total_pages:
                    page_num = 0

                page = doc[page_num]
                # High-fidelity zoom factor: 300 DPI / 72 standard PDF DPI ≈ 4.166
                zoom = self.target_dpi / 72.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)

                img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                if pix.n == 4:  # RGBA
                    bgr_img = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                elif pix.n == 3:  # RGB
                    bgr_img = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                else:  # Grayscale
                    bgr_img = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)

                return bgr_img, total_pages

        # For static image files (JPEG, PNG, TIFF, WEBP)
        try:
            # Load with PIL first to automatically handle EXIF orientation tags from smartphone cameras
            with Image.open(file_path) as pil_img:
                pil_img = ImageOps.exif_transpose(pil_img)
                if pil_img.mode != "RGB":
                    pil_img = pil_img.convert("RGB")
                rgb_arr = np.array(pil_img)
                bgr_img = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
                return bgr_img, 1
        except Exception as e:
            logger.warning(f"PIL failed to load {file_path}, falling back to cv2.imread: {e}")
            bgr_img = cv2.imread(file_path)
            if bgr_img is None:
                raise ValueError(f"Could not decode image from {file_path}")
            return bgr_img, 1

    def detect_and_correct_deskew(
        self, image: np.ndarray, max_angle_abs: float = 30.0
    ) -> Tuple[np.ndarray, float]:
        """
        Detects tilt/skew in prescription handwriting and rotates image to level lines.
        Only corrects if detected angle is between 0.5° and max_angle_abs°.
        """
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Invert: text becomes white, background black
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 15
        )

        # Detect horizontal line structures via morphological operation
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
        line_morph = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

        # Find coordinates of all text/line points
        coords = np.column_stack(np.where(line_morph > 0))
        if len(coords) < 100:
            # Fallback to standard non-zero coordinates
            coords = np.column_stack(np.where(thresh > 0))

        if len(coords) < 200:
            return image, 0.0

        # Compute minimum area rectangle enclosing the text
        min_rect = cv2.minAreaRect(coords)
        angle = min_rect[-1]

        # OpenCV minAreaRect returns angle in [-90, 0)
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # If detected angle is too extreme, it might be vertical text or noise
        if abs(angle) > max_angle_abs or abs(angle) < 0.4:
            return image, 0.0

        # Rotate around image center with white background padding
        center = (w // 2, h // 2)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            image,
            rot_mat,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255),
        )

        logger.info(f"Prescription deskewed by {angle:.2f} degrees")
        return rotated, float(round(angle, 2))

    def detect_and_crop_document_margins(
        self, image: np.ndarray, min_area_ratio: float = 0.35, margin_padding: int = 30
    ) -> Tuple[np.ndarray, bool]:
        """
        Detects outer paper boundaries if prescription was photographed on a dark surface/table.
        Adds safety margin padding so doctor stamps, date, and signatures are preserved.
        """
        h, w = image.shape[:2]
        total_area = h * w

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)

        # Dilate edges to close gaps in paper boundary
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        dilated = cv2.dilate(edges, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return image, False

        # Find largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)

        # Check if the paper contour is significant and not almost the full image already
        if area > (total_area * min_area_ratio) and area < (total_area * 0.96):
            x, y, cw, ch = cv2.boundingRect(largest_contour)

            # Apply safety margin padding
            x_start = max(0, x - margin_padding)
            y_start = max(0, y - margin_padding)
            x_end = min(w, x + cw + margin_padding)
            y_end = min(h, y + ch + margin_padding)

            # Verify reasonable aspect ratio for a prescription sheet
            aspect = float(x_end - x_start) / max(1, (y_end - y_start))
            if 0.4 <= aspect <= 2.5:
                cropped = image[y_start:y_end, x_start:x_end]
                logger.info(f"Cropped prescription to paper bounds: {cw}x{ch} from original {w}x{h}")
                return cropped, True

        return image, False

    def enhance_contrast_and_lighting(
        self, image: np.ndarray, clip_limit: float = 2.0
    ) -> Tuple[np.ndarray, bool]:
        """
        Applies Contrast Limited Adaptive Histogram Equalization (CLAHE) on L-channel
        and background division to remove harsh shadows from mobile camera shots
        while preserving faint blue/black doctor handwriting strokes.
        """
        try:
            # Convert to LAB color space
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l_channel, a_channel, b_channel = cv2.split(lab)

            # 1. Background division for uneven illumination / shadow gradients
            # Approximate illumination using large Gaussian filter
            dilated = cv2.dilate(l_channel, np.ones((7, 7), np.uint8))
            bg_illum = cv2.medianBlur(dilated, 21)
            # Difference from background
            diff = 255 - cv2.absdiff(l_channel, bg_illum)
            norm_l = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8U)

            # 2. CLAHE on normalized L channel
            clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
            enhanced_l = clahe.apply(norm_l)

            # Blend 70% enhanced L with 30% original L to avoid artificial grain
            blended_l = cv2.addWeighted(enhanced_l, 0.75, l_channel, 0.25, 0)

            merged_lab = cv2.merge([blended_l, a_channel, b_channel])
            enhanced_bgr = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)

            return enhanced_bgr, True
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {e}")
            return image, False

    def resize_for_inference(self, image: np.ndarray) -> np.ndarray:
        """Limits maximum image dimension to avoid memory exhaustion during VLM inference."""
        h, w = image.shape[:2]
        if max(h, w) > self.max_dimension:
            scale = self.max_dimension / float(max(h, w))
            new_w = int(w * scale)
            new_h = int(h * scale)
            return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return image

    def preprocess_prescription(
        self,
        file_path: str,
        mime_type: str,
        page_num: int = 0,
        enable_deskew: bool = True,
        enable_crop: bool = True,
        enable_clahe: bool = True,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Complete end-to-end preprocessing pipeline for handwritten medical prescriptions.
        Returns processed BGR image array and execution metadata.
        """
        raw_bgr, total_pages = self.load_raw_page_image(file_path, mime_type, page_num)
        orig_h, orig_w = raw_bgr.shape[:2]

        current_img = raw_bgr
        deskew_angle = 0.0
        cropped = False
        clahe_applied = False

        # 1. Deskew
        if enable_deskew:
            current_img, deskew_angle = self.detect_and_correct_deskew(current_img)

        # 2. Auto-crop paper margins
        if enable_crop:
            current_img, cropped = self.detect_and_crop_document_margins(current_img)

        # 3. Contrast enhancement and shadow correction
        if enable_clahe:
            current_img, clahe_applied = self.enhance_contrast_and_lighting(current_img)

        # 4. Dimension safety clamping
        processed_img = self.resize_for_inference(current_img)
        final_h, final_w = processed_img.shape[:2]

        metadata = {
            "source_file": os.path.basename(file_path),
            "page_num": page_num + 1,
            "total_pages": total_pages,
            "original_dimensions": {"width": orig_w, "height": orig_h},
            "processed_dimensions": {"width": final_w, "height": final_h},
            "deskew_angle_degrees": deskew_angle,
            "auto_cropped": cropped,
            "clahe_enhanced": clahe_applied,
        }

        return processed_img, metadata

    def image_to_jpeg_bytes(self, image: np.ndarray, quality: int = 95) -> bytes:
        """Encodes BGR numpy image array into standard JPEG bytes."""
        success, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not success:
            raise ValueError("Failed to encode image to JPEG bytes")
        return encoded.tobytes()

    def image_to_pil(self, image: np.ndarray) -> Image.Image:
        """Converts BGR numpy image array to PIL Image in RGB format."""
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)


prescription_preprocessor = PrescriptionPreprocessor()
