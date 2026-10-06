import time
import json
import re
from typing import Any, Dict, Optional, Tuple
from pydantic import ValidationError
from app.schemas.ai_extraction import StructuredMedicalData
from app.services.llm_provider import LLMProviderFactory, DeterministicClinicalNERProvider
from app.core.logging import logger


class AIExtractionService:
    """
    AI-Powered Structured Medical Information Extraction Service.
    Applies strict Pydantic validation and resilient JSON error recovery.
    """

    async def extract_structured_data(
        self, ocr_text: str
    ) -> Dict[str, Any]:
        """
        Extracts structured medical JSON from OCR text with validation and resilience.
        """
        start_time = time.time()

        if not ocr_text or not ocr_text.strip():
            empty_data = StructuredMedicalData()
            return {
                "success": False,
                "error": "OCR text is empty. Cannot extract clinical information.",
                "model_name": "none",
                "raw_response": "{}",
                "structured_data": empty_data.model_dump(),
                "confidence_score": 0.0,
                "processing_time": 0.0,
            }

        provider = LLMProviderFactory.get_provider()
        model_name = provider.model_name
        raw_response = "{}"
        parsed_dict = {}

        try:
            logger.info(f"Running structured AI extraction using {model_name}...")
            raw_response, parsed_dict = await provider.extract_medical_data(ocr_text)
        except Exception as exc:
            logger.error(f"Primary provider {model_name} failed: {exc}. Using deterministic fallback...")
            fallback_provider = DeterministicClinicalNERProvider()
            model_name = fallback_provider.model_name
            raw_response, parsed_dict = await fallback_provider.extract_medical_data(ocr_text)

        # Resilient JSON repair if raw_response is a string but parsed_dict is not populated
        if not parsed_dict and isinstance(raw_response, str):
            parsed_dict = self._safe_parse_json(raw_response)

        # If parsed_dict is still invalid, run deterministic extractor
        if not parsed_dict or not isinstance(parsed_dict, dict):
            logger.warning("Provider returned invalid JSON format. Recovering with clinical parser...")
            fallback_provider = DeterministicClinicalNERProvider()
            model_name = fallback_provider.model_name
            raw_response, parsed_dict = await fallback_provider.extract_medical_data(ocr_text)

        # Validate through Pydantic
        try:
            validated_model = StructuredMedicalData.model_validate(parsed_dict)
        except ValidationError as val_err:
            logger.warning(f"Pydantic validation notice: {val_err}. Normalizing dictionary structure...")
            sanitized = self._sanitize_for_schema(parsed_dict)
            try:
                validated_model = StructuredMedicalData.model_validate(sanitized)
            except ValidationError as fatal_err:
                logger.error(f"Unrecoverable schema validation error: {fatal_err}")
                return {
                    "success": False,
                    "error": f"Schema validation error: {str(fatal_err)}",
                    "model_name": model_name,
                    "raw_response": str(raw_response),
                    "structured_data": StructuredMedicalData().model_dump(),
                    "confidence_score": 0.0,
                    "processing_time": round(time.time() - start_time, 2),
                }

        processing_time = round(time.time() - start_time, 2)
        confidence = validated_model.overall_confidence

        return {
            "success": True,
            "error": None,
            "model_name": model_name,
            "raw_response": raw_response,
            "structured_data": validated_model.model_dump(),
            "confidence_score": confidence,
            "processing_time": processing_time,
        }

    def _safe_parse_json(self, text: str) -> Dict[str, Any]:
        """Attempt to extract and parse JSON from model output."""
        try:
            return json.loads(text)
        except Exception:
            pass

        # Strip markdown ```json ... ``` blocks
        clean = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        clean = re.sub(r"\s*```$", "", clean.strip(), flags=re.MULTILINE)
        try:
            return json.loads(clean)
        except Exception:
            pass

        # Search for outer curly braces
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                pass

        return {}

    def _sanitize_for_schema(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize types and ensure lists and dicts conform to schema requirements."""
        res = dict(data)
        for key in ["diagnoses", "medications", "laboratory_tests", "observations", "reference_ranges", "units", "abnormal_flags"]:
            if not isinstance(res.get(key), list):
                res[key] = []

        if not isinstance(res.get("field_confidences"), dict):
            res["field_confidences"] = {}

        if not isinstance(res.get("overall_confidence"), (int, float)):
            res["overall_confidence"] = 0.0

        return res


ai_extraction_service = AIExtractionService()
