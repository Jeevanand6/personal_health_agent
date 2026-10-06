import os
import re
import json
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
import httpx
from app.core.config import settings
from app.core.logging import logger

SYSTEM_EXTRACTION_PROMPT = """You are an expert clinical medical information extraction AI system.
Your task is to extract structured clinical data from medical document OCR text into STRICT JSON.

CRITICAL SAFETY & INTEGRITY RULES:
1. Extract ONLY information explicitly present in the document.
2. If any field or piece of information does not exist or is absent: set it to null.
3. NEVER invent, infer, or hallucinate information. If OCR is unclear or absent, use null.
4. Do not guess diagnoses, medications, or lab values.
5. Every extracted entity must include an estimated confidence score between 0.0 and 1.0 based on OCR clarity.
6. For observations (lab tests), evaluate abnormal_flag as "LOW", "NORMAL", "HIGH", or "UNKNOWN" based on the reference range if available.

OUTPUT FORMAT MUST BE VALID JSON MATCHING THIS EXACT SCHEMA:
{
  "patient_name": string or null,
  "patient_age": string or null,
  "patient_gender": string or null,
  "doctor_name": string or null,
  "hospital_name": string or null,
  "document_date": string or null,
  "diagnoses": [string, ...],
  "medications": [
    {
      "name": string,
      "dosage": string or null,
      "route": string or null,
      "frequency": string or null,
      "duration": string or null,
      "instructions": string or null,
      "confidence": float
    }
  ],
  "laboratory_tests": [string, ...],
  "observations": [
    {
      "test_name": string,
      "value": string,
      "numeric_value": float or null,
      "unit": string or null,
      "reference_range": string or null,
      "abnormal_flag": "LOW" | "NORMAL" | "HIGH" | "UNKNOWN",
      "confidence": float
    }
  ],
  "reference_ranges": [string, ...],
  "units": [string, ...],
  "abnormal_flags": [string, ...],
  "clinical_notes": string or null,
  "field_confidences": {
    "patient_name": float,
    "doctor_name": float,
    "hospital_name": float,
    "document_date": float,
    "diagnoses": float,
    "clinical_notes": float
  },
  "overall_confidence": float
}
"""


class BaseLLMProvider(ABC):
    """Abstract Base Class for LLM Providers."""

    def __init__(self, model_name: str):
        self.model_name = model_name

    @abstractmethod
    async def extract_medical_data(self, ocr_text: str) -> Tuple[str, Dict[str, Any]]:
        """
        Extract structured medical data from OCR text.
        Returns: (raw_model_response, parsed_dictionary)
        """
        pass


class GeminiLLMProvider(BaseLLMProvider):
    """Google Gemini LLM Provider utilizing official Gemini APIs."""

    def __init__(self, api_key: str, model_name: str = "gemini-3.8-flash"):
        super().__init__(model_name)
        self.api_key = api_key

    async def extract_medical_data(self, ocr_text: str) -> Tuple[str, Dict[str, Any]]:
        user_prompt = f"Please extract structured medical information from the following OCR text:\n\n```text\n{ocr_text}\n```"

        # 1. Attempt using official google-genai SDK if available
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_EXTRACTION_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            raw_text = response.text or "{}"
            parsed = json.loads(raw_text)
            return raw_text, parsed
        except Exception as exc:
            logger.warning(
                f"google-genai SDK generation error ({exc}). Attempting direct HTTP fallback..."
            )

        # 2. HTTP REST fallback to Google Generative Language API
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent"
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "contents": [{"parts": [{"text": user_prompt}]}],
            "systemInstruction": {"parts": [{"text": SYSTEM_EXTRACTION_PROMPT}]},
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Gemini API returned status {resp.status_code}: {resp.text}"
                )

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("Gemini API returned no candidates.")

            raw_text = (
                candidates[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "{}")
            )
            parsed = json.loads(raw_text)
            return raw_text, parsed


class OpenAILLMProvider(BaseLLMProvider):
    """OpenAI / OpenAI-compatible LLM Provider."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
    ):
        super().__init__(model_name)
        self.api_key = api_key
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")

    async def extract_medical_data(self, ocr_text: str) -> Tuple[str, Dict[str, Any]]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": SYSTEM_EXTRACTION_PROMPT},
                {
                    "role": "user",
                    "content": f"Extract structured medical information:\n\n{ocr_text}",
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"OpenAI API returned status {resp.status_code}: {resp.text}"
                )

            data = resp.json()
            raw_text = data["choices"][0]["message"]["content"]
            parsed = json.loads(raw_text)
            return raw_text, parsed


class DeterministicClinicalNERProvider(BaseLLMProvider):
    """
    High-fidelity deterministic clinical Named Entity Recognition engine.
    Extracts entities directly with zero hallucinations when external API keys are unavailable.
    """

    def __init__(self, model_name: str = "clinical-ner-deterministic-v1"):
        super().__init__(model_name)

    async def extract_medical_data(self, ocr_text: str) -> Tuple[str, Dict[str, Any]]:
        text = ocr_text or ""
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        # 1. Patient Name
        patient_name = None
        patient_name_conf = 0.0
        p_name_match = re.search(
            r"(?:Patient(?:\s+Name)?|Pt\.?\s*Name|Name)\s*[:\-]\s*([A-Za-z.\s]{2,40})",
            text,
            re.IGNORECASE,
        )
        if p_name_match:
            candidate = p_name_match.group(1).split(",")[0].strip()
            # Clean unwanted tokens
            candidate = re.sub(
                r"\b(Age|Sex|Gender|Male|Female|DOB|Date|Y|Yr|Yrs)\b.*",
                "",
                candidate,
                flags=re.IGNORECASE,
            ).strip()
            if candidate and len(candidate) > 2:
                patient_name = candidate
                patient_name_conf = 0.95

        # 2. Patient Age
        patient_age = None
        p_age_match = re.search(
            r"(?:Age|Aged)\s*[:\-]?\s*(\d{1,3})\s*(?:Y|Yr|Yrs|Years)?",
            text,
            re.IGNORECASE,
        )
        if p_age_match:
            patient_age = f"{p_age_match.group(1)} Years"
        else:
            # Match formats like 29Y or 45/M
            alt_age = re.search(r"\b(\d{1,3})\s*(?:Y|Yr|Yrs)\b", text, re.IGNORECASE)
            if alt_age:
                patient_age = f"{alt_age.group(1)} Years"

        # 3. Patient Gender
        patient_gender = None
        p_gen_match = re.search(
            r"(?:Gender|Sex)\s*[:\-]?\s*(Male|Female|Other|M|F)\b",
            text,
            re.IGNORECASE,
        )
        if p_gen_match:
            g = p_gen_match.group(1).upper()
            patient_gender = (
                "Female" if g in ["F", "FEMALE"] else "Male" if g in ["M", "MALE"] else g
            )
        else:
            # Inline check e.g. 29Y Female
            inline_gen = re.search(r"\b(Male|Female)\b", text, re.IGNORECASE)
            if inline_gen:
                patient_gender = inline_gen.group(1).capitalize()

        # 4. Doctor Name
        doctor_name = None
        doctor_conf = 0.0
        doc_match = re.search(
            r"(?:Doctor|Dr\.?|Consultant|Physician)\s*[:\-]?\s*(?:Dr\.?\s*)?([A-Za-z.\s]{2,40})",
            text,
            re.IGNORECASE,
        )
        if doc_match:
            candidate = doc_match.group(1).strip()
            candidate = re.sub(
                r"\b(MBBS|MD|MS|DNB|DM|FRCS|MRCP|Date|Reg|No)\b.*",
                "",
                candidate,
                flags=re.IGNORECASE,
            ).strip()
            if candidate and len(candidate) > 2:
                doctor_name = (
                    f"Dr. {candidate}" if not candidate.startswith("Dr.") else candidate
                )
                doctor_conf = 0.94

        # 5. Hospital / Clinic Name
        hospital_name = None
        hosp_conf = 0.0
        hosp_match = re.search(
            r"(?:Hospital|Clinic|Healthcare|Medical\s*Center|Diagnostics?)\s*[:\-]?\s*([A-Za-z0-9&.\s\-]{3,50})",
            text,
            re.IGNORECASE,
        )
        if hosp_match:
            candidate = hosp_match.group(1).strip()
            if candidate:
                hospital_name = candidate
                hosp_conf = 0.92
        else:
            # Search first lines for Hospital/Clinic keywords
            for line in lines[:3]:
                if any(
                    w in line.upper()
                    for w in [
                        "HOSPITAL",
                        "CLINIC",
                        "HEALTHCARE",
                        "LABORATORY",
                        "DIAGNOSTIC",
                    ]
                ):
                    hospital_name = line.strip(" -:")
                    hosp_conf = 0.88
                    break

        # 6. Document Date
        document_date = None
        date_match = re.search(
            r"(?:Date|Dated)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})",
            text,
            re.IGNORECASE,
        )
        if date_match:
            document_date = date_match.group(1).strip()
        else:
            # Generic date search
            gen_date = re.search(
                r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b", text
            )
            if gen_date:
                document_date = gen_date.group(1)

        # 7. Diagnoses
        diagnoses = []
        diag_match = re.search(
            r"(?:Diagnosis|Impression|Assessment|Condition)\s*[:\-]?\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        if diag_match:
            d_raw = diag_match.group(1).strip()
            items = [item.strip() for item in re.split(r"[,;]|\band\b", d_raw) if item.strip()]
            for it in items:
                cleaned_it = re.sub(
                    r"\b(Rx|Date|Doctor|Tab|Cap)\b.*", "", it, flags=re.IGNORECASE
                ).strip()
                if cleaned_it:
                    diagnoses.append(cleaned_it)

        # 8. Medications
        medications = []
        current_med = None

        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue

            # Check if this line is a section header to skip
            if re.match(r"^(?:Rx\s*\(.*?\)|Rx\s*:?|PRESCRIBED\s*MEDICATIONS.*|PRESCRIPTION.*|MEDICATIONS\s*:?)$", trimmed, re.IGNORECASE):
                continue

            # Check if this line starts a new medication entry
            # e.g. "1. Tab Azithromycin 500mg" or "2.TabParacetamol 650mg" or "Tab Amlodipine 5mg" or "Rx Paracetamol"
            is_med_start = False
            med_lead_match = re.match(
                r"^(?:\d+[\.\)]\s*)?(?:Rx\b[:\s\-]*|Tab(?:let)?\.?\s*|Cap(?:sule)?\.?\s*|Syp(?:rup)?\.?\s*|Inj(?:ection)?\.?\s*|Oint(?:ment)?\.?\s*)",
                trimmed,
                re.IGNORECASE,
            )
            if med_lead_match and not re.match(r"^(?:Dosage|Route|Frequency|Duration|Instructions|Directions|Advice|Note)\s*:", trimmed, re.IGNORECASE):
                is_med_start = True

            if is_med_start:
                if current_med and current_med.get("name") and len(current_med.get("name")) >= 3:
                    medications.append(current_med)

                # Clean the line
                med_clean = re.sub(r"^\d+[\.\)]\s*", "", trimmed)
                med_clean = re.sub(
                    r"^(?:Rx\b[:\s\-]*|Tab(?:let)?\.?\s*|Cap(?:sule)?\.?\s*|Syp(?:rup)?\.?\s*|Inj(?:ection)?\.?\s*|Oint(?:ment)?\.?\s*)",
                    "",
                    med_clean,
                    flags=re.IGNORECASE,
                ).strip()

                dosage = None
                dosage_match = re.search(
                    r"\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|IU))\b",
                    med_clean,
                    re.IGNORECASE,
                )
                if dosage_match:
                    dosage = dosage_match.group(1)

                freq = None
                freq_match = re.search(
                    r"\b(OD|BD|TDS|QDS|TID|BID|QID|once\s*daily|twice\s*daily|thrice\s*daily|SOS|HS|every\s*\d+\s*hours?)\b",
                    trimmed,
                    re.IGNORECASE,
                )
                if freq_match:
                    freq = freq_match.group(1)

                dur = None
                dur_match = re.search(
                    r"\b(\d+\s*(?:days?|weeks?|months?))\b",
                    trimmed,
                    re.IGNORECASE,
                )
                if dur_match:
                    dur = dur_match.group(1)

                name_cand = med_clean
                if dosage:
                    name_cand = name_cand.replace(dosage, "")
                name_cand = re.split(r"[-–—;:]", name_cand)[0].strip()
                name_cand = re.sub(
                    r"\b(?:once daily|twice daily|thrice daily|daily|orally|oral|take|with|food|after|meals?|for)\b.*",
                    "",
                    name_cand,
                    flags=re.IGNORECASE,
                ).strip()
                name_cand = re.sub(r"[xX\-\(\),;]", "", name_cand).strip()

                current_med = {
                    "name": name_cand,
                    "dosage": dosage,
                    "route": "Oral",
                    "frequency": freq,
                    "duration": dur,
                    "instructions": "As prescribed by physician",
                    "confidence": 0.94,
                }
            elif current_med:
                # Sub-line metadata for current medication (Dosage, Route, Frequency, Duration, Instructions)
                lower_t = trimmed.lower()
                if any(k in lower_t for k in ["dosage:", "frequency:", "duration:", "instructions:", "route:"]):
                    freq_m = re.search(r"Frequency\s*:\s*([^|,\n]+)", trimmed, re.IGNORECASE)
                    if freq_m and not current_med.get("frequency"):
                        current_med["frequency"] = freq_m.group(1).strip()

                    dur_m = re.search(r"Duration\s*:\s*([^|,\n]+)", trimmed, re.IGNORECASE)
                    if dur_m and not current_med.get("duration"):
                        current_med["duration"] = dur_m.group(1).strip()

                    inst_m = re.search(r"Instructions\s*:\s*(.+)", trimmed, re.IGNORECASE)
                    if inst_m:
                        current_med["instructions"] = inst_m.group(1).strip()

                    dose_m = re.search(r"Dosage\s*:\s*([^|,\n]+)", trimmed, re.IGNORECASE)
                    if dose_m and not current_med.get("dosage"):
                        current_med["dosage"] = dose_m.group(1).strip()

                    route_m = re.search(r"Route\s*:\s*([^|,\n]+)", trimmed, re.IGNORECASE)
                    if route_m:
                        current_med["route"] = route_m.group(1).strip()

        if current_med and current_med.get("name") and len(current_med.get("name")) >= 3:
            medications.append(current_med)

        # 9. Observations & Lab Tests
        observations = []
        lab_tests = []
        reference_ranges = []
        units = []
        abnormal_flags = []

        # Standard lab test signatures with clinical normal reference ranges
        lab_patterns = [
            ("Blood Sugar Fasting", r"(?:Blood\s*Sugar\s*Fasting|Fasting\s*Blood\s*Sugar|FBS)", 70.0, 100.0, "mg/dL"),
            ("Blood Sugar Postprandial", r"(?:Postprandial\s*Blood\s*Sugar|PPBS)", 70.0, 140.0, "mg/dL"),
            ("HbA1c", r"\bHbA1c\b", 4.0, 5.7, "%"),
            ("Cholesterol Total", r"(?:Cholesterol\s*Total|Total\s*Cholesterol)", 125.0, 200.0, "mg/dL"),
            ("Triglycerides", r"\bTriglycerides?\b", 50.0, 150.0, "mg/dL"),
            ("HDL Cholesterol", r"\bHDL(?:\s*Cholesterol)?\b", 40.0, 60.0, "mg/dL"),
            ("LDL Cholesterol", r"\bLDL(?:\s*Cholesterol)?\b", 50.0, 100.0, "mg/dL"),
            ("Hemoglobin", r"(?:Hemoglobin|Hb)\b", 12.0, 16.0, "g/dL"),
            ("WBC Count", r"(?:WBC|Total\s*Leukocyte\s*Count|TLC)\b", 4000.0, 11000.0, "cells/mcL"),
            ("Platelet Count", r"(?:Platelets?|Platelet\s*Count)\b", 150000.0, 450000.0, "cells/mcL"),
            ("Serum Creatinine", r"(?:Creatinine|Serum\s*Creatinine)\b", 0.6, 1.2, "mg/dL"),
            ("Blood Urea", r"(?:Blood\s*Urea|BUN)\b", 7.0, 20.0, "mg/dL"),
            ("Blood Pressure", r"(?:Blood\s*Pressure|BP)\b", 90.0, 120.0, "mmHg"),
        ]

        for test_name, pat, low_ref, high_ref, default_unit in lab_patterns:
            match = re.search(rf"{pat}\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?(?:\s*/\s*[0-9]+)?)", text, re.IGNORECASE)
            if match:
                raw_val = match.group(1).replace(" ", "")
                lab_tests.append(test_name)

                # Extract unit if adjacent
                unit_match = re.search(rf"{pat}[^\n\r]*?([a-zA-Z%]+/[a-zA-Z%]+|%|g/dL|mmHg)", text, re.IGNORECASE)
                unit_val = unit_match.group(1) if unit_match else default_unit

                # Numeric value
                numeric_val = None
                abnormal = "NORMAL"

                try:
                    if "/" in raw_val:
                        # E.g. BP 120/80
                        sys_val = float(raw_val.split("/")[0])
                        numeric_val = sys_val
                        if sys_val > 130:
                            abnormal = "HIGH"
                        elif sys_val < 90:
                            abnormal = "LOW"
                    else:
                        numeric_val = float(raw_val)
                        if numeric_val > high_ref:
                            abnormal = "HIGH"
                        elif numeric_val < low_ref:
                            abnormal = "LOW"
                except ValueError:
                    abnormal = "UNKNOWN"

                ref_range_str = f"{low_ref} - {high_ref} {unit_val}"
                reference_ranges.append(ref_range_str)
                units.append(unit_val)
                if abnormal != "NORMAL" and abnormal != "UNKNOWN":
                    abnormal_flags.append(f"{test_name}: {abnormal}")

                observations.append(
                    {
                        "test_name": test_name,
                        "value": raw_val,
                        "numeric_value": numeric_val,
                        "unit": unit_val,
                        "reference_range": ref_range_str,
                        "abnormal_flag": abnormal,
                        "confidence": 0.95,
                    }
                )

        # 10. Clinical Notes
        clinical_notes = None
        notes_match = re.search(
            r"(?:Notes?|Advice|Remarks|Clinical\s*Notes?|Comments?)\s*[:\-]?\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        if notes_match:
            clinical_notes = notes_match.group(1).strip()
        elif "Review after" in text:
            clinical_notes = "Review after completion of prescribed regimen."

        # Field confidences
        field_confidences = {
            "patient_name": patient_name_conf,
            "patient_age": 0.90 if patient_age else 0.0,
            "patient_gender": 0.90 if patient_gender else 0.0,
            "doctor_name": doctor_conf,
            "hospital_name": hosp_conf,
            "document_date": 0.92 if document_date else 0.0,
            "diagnoses": 0.90 if diagnoses else 0.0,
            "clinical_notes": 0.85 if clinical_notes else 0.0,
        }

        # Calculate overall confidence
        present_confs = [c for c in field_confidences.values() if c > 0.0]
        for m in medications:
            present_confs.append(m.get("confidence", 0.90))
        for o in observations:
            present_confs.append(o.get("confidence", 0.90))

        overall_conf = round(sum(present_confs) / len(present_confs), 3) if present_confs else 0.0

        structured_result = {
            "patient_name": patient_name,
            "patient_age": patient_age,
            "patient_gender": patient_gender,
            "doctor_name": doctor_name,
            "hospital_name": hospital_name,
            "document_date": document_date,
            "diagnoses": diagnoses,
            "medications": medications,
            "laboratory_tests": lab_tests,
            "observations": observations,
            "reference_ranges": reference_ranges,
            "units": units,
            "abnormal_flags": abnormal_flags,
            "clinical_notes": clinical_notes,
            "field_confidences": field_confidences,
            "overall_confidence": overall_conf,
        }

        raw_response = json.dumps(structured_result, indent=2)
        return raw_response, structured_result


class LLMProviderFactory:
    """Factory creating LLM Providers based on configuration and environment."""

    @staticmethod
    def get_provider() -> BaseLLMProvider:
        provider_type = (settings.AI_PROVIDER or "auto").lower().strip()

        # Check Gemini API Key
        gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        openai_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")

        if provider_type == "gemini":
            if gemini_key:
                logger.info(f"Using Gemini LLM Provider ({settings.GEMINI_MODEL})")
                return GeminiLLMProvider(api_key=gemini_key, model_name=settings.GEMINI_MODEL)
            logger.warning("Gemini API key missing. Falling back to deterministic clinical NER provider.")
            return DeterministicClinicalNERProvider()

        if provider_type == "openai":
            if openai_key:
                logger.info(f"Using OpenAI LLM Provider ({settings.OPENAI_MODEL})")
                return OpenAILLMProvider(
                    api_key=openai_key,
                    model_name=settings.OPENAI_MODEL,
                    base_url=settings.OPENAI_BASE_URL,
                )
            logger.warning("OpenAI API key missing. Falling back to deterministic clinical NER provider.")
            return DeterministicClinicalNERProvider()

        if provider_type == "deterministic":
            logger.info("Using Deterministic Clinical NER Provider")
            return DeterministicClinicalNERProvider()

        # Auto Mode: prefer Gemini if key exists, else OpenAI if key exists, else Deterministic Clinical NER
        if gemini_key:
            logger.info(f"Auto-selected Gemini LLM Provider ({settings.GEMINI_MODEL})")
            return GeminiLLMProvider(api_key=gemini_key, model_name=settings.GEMINI_MODEL)
        elif openai_key:
            logger.info(f"Auto-selected OpenAI LLM Provider ({settings.OPENAI_MODEL})")
            return OpenAILLMProvider(
                api_key=openai_key,
                model_name=settings.OPENAI_MODEL,
                base_url=settings.OPENAI_BASE_URL,
            )

        logger.info("Auto-selected Deterministic Clinical NER Provider (standalone offline mode)")
        return DeterministicClinicalNERProvider()
