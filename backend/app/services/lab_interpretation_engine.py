import re
import uuid
from typing import Dict, Any, List, Optional, Tuple
from app.models.observation_interpretation import (
    ObservationStatus,
    InterpretationSeverity,
    ObservationInterpretation,
)
from app.core.logging import logger

CURATED_KB_VERSION = "CURATED_CLINICAL_LAB_GUIDELINES_V1_2026"

# Curated configuration for common laboratory reference ranges
# Only used when:
# 1. Test is confidently identified (confidence >= 0.8)
# 2. Unit is known and matches accepted clinical units
# 3. Patient context is sufficient (adult context or gender if test requires gender)
# 4. Source & version are explicitly recorded
CURATED_LAB_REFERENCE_RANGES: Dict[str, Dict[str, Any]] = {
    "fasting_blood_sugar": {
        "canonical_name": "Fasting Blood Sugar (FBS)",
        "aliases": [
            "fasting blood sugar",
            "fbs",
            "glucose fasting",
            "fasting plasma glucose",
            "fasting glucose",
            "blood sugar fasting",
        ],
        "accepted_units": ["mg/dl", "mg%"],
        "default_range": (70.0, 99.0),
        "urgent_low": 50.0,
        "urgent_high": 300.0,
        "requires_gender": False,
    },
    "postprandial_blood_sugar": {
        "canonical_name": "Postprandial Blood Sugar (PPBS)",
        "aliases": [
            "postprandial blood sugar",
            "ppbs",
            "glucose postprandial",
            "glucose post prandial",
            "post prandial blood sugar",
            "blood sugar postprandial",
        ],
        "accepted_units": ["mg/dl", "mg%"],
        "default_range": (70.0, 139.0),
        "urgent_low": 50.0,
        "urgent_high": 350.0,
        "requires_gender": False,
    },
    "hba1c": {
        "canonical_name": "HbA1c (Glycated Hemoglobin)",
        "aliases": [
            "hba1c",
            "glycated hemoglobin",
            "glycosylated hemoglobin",
            "hemoglobin a1c",
            "a1c",
        ],
        "accepted_units": ["%"],
        "default_range": (4.0, 5.6),
        "urgent_low": None,
        "urgent_high": 10.0,
        "requires_gender": False,
    },
    "serum_creatinine": {
        "canonical_name": "Serum Creatinine",
        "aliases": [
            "serum creatinine",
            "creatinine",
            "s. creatinine",
            "s creatinine",
        ],
        "accepted_units": ["mg/dl"],
        "default_range": (0.6, 1.2),
        "gender_ranges": {
            "Male": (0.7, 1.3),
            "Female": (0.6, 1.1),
        },
        "urgent_low": None,
        "urgent_high": 3.0,
        "requires_gender": True,
    },
    "blood_urea_nitrogen": {
        "canonical_name": "Blood Urea Nitrogen (BUN)",
        "aliases": ["blood urea nitrogen", "bun", "urea", "serum urea"],
        "accepted_units": ["mg/dl"],
        "default_range": (7.0, 20.0),
        "urgent_low": None,
        "urgent_high": 60.0,
        "requires_gender": False,
    },
    "total_cholesterol": {
        "canonical_name": "Total Cholesterol",
        "aliases": [
            "total cholesterol",
            "cholesterol total",
            "serum cholesterol",
            "cholesterol",
        ],
        "accepted_units": ["mg/dl"],
        "default_range": (125.0, 200.0),
        "urgent_low": None,
        "urgent_high": 350.0,
        "requires_gender": False,
    },
    "hdl_cholesterol": {
        "canonical_name": "HDL Cholesterol",
        "aliases": [
            "hdl cholesterol",
            "hdl",
            "high density lipoprotein",
            "hdl-c",
        ],
        "accepted_units": ["mg/dl"],
        "default_range": (40.0, 60.0),
        "gender_ranges": {
            "Male": (40.0, 60.0),
            "Female": (50.0, 60.0),
        },
        "urgent_low": None,
        "urgent_high": None,
        "requires_gender": False,
    },
    "ldl_cholesterol": {
        "canonical_name": "LDL Cholesterol",
        "aliases": [
            "ldl cholesterol",
            "ldl",
            "low density lipoprotein",
            "ldl-c",
        ],
        "accepted_units": ["mg/dl"],
        "default_range": (50.0, 100.0),
        "urgent_low": None,
        "urgent_high": 250.0,
        "requires_gender": False,
    },
    "triglycerides": {
        "canonical_name": "Triglycerides",
        "aliases": ["triglycerides", "serum triglycerides", "tg"],
        "accepted_units": ["mg/dl"],
        "default_range": (50.0, 150.0),
        "urgent_low": None,
        "urgent_high": 500.0,
        "requires_gender": False,
    },
    "hemoglobin": {
        "canonical_name": "Hemoglobin (Hb)",
        "aliases": ["hemoglobin", "hb", "total hemoglobin", "haemoglobin"],
        "accepted_units": ["g/dl", "gm/dl", "g%"],
        "default_range": (12.0, 16.0),
        "gender_ranges": {
            "Male": (13.5, 17.5),
            "Female": (12.0, 15.5),
        },
        "urgent_low": 7.0,
        "urgent_high": 20.0,
        "requires_gender": True,
    },
    "platelet_count": {
        "canonical_name": "Platelet Count",
        "aliases": [
            "platelet count",
            "platelets",
            "total platelet count",
            "plt",
        ],
        "accepted_units": ["/ul", "cells/mcl", "/cumm", "k/ul", "/mm3"],
        "default_range": (150000.0, 450000.0),
        "urgent_low": 50000.0,
        "urgent_high": 1000000.0,
        "requires_gender": False,
    },
    "wbc_count": {
        "canonical_name": "Total White Blood Cell Count (WBC)",
        "aliases": [
            "total leukocyte count",
            "total white blood cell count",
            "wbc",
            "tlc",
            "white blood cells",
        ],
        "accepted_units": ["/ul", "cells/mcl", "/cumm", "k/ul", "/mm3"],
        "default_range": (4000.0, 11000.0),
        "urgent_low": 2000.0,
        "urgent_high": 30000.0,
        "requires_gender": False,
    },
    "tsh": {
        "canonical_name": "Thyroid Stimulating Hormone (TSH)",
        "aliases": [
            "tsh",
            "thyroid stimulating hormone",
            "ultrasensitive tsh",
            "s. tsh",
        ],
        "accepted_units": ["uiy/ml", "miu/l", "uiu/ml", "uIU/mL", "mIU/L"],
        "default_range": (0.4, 4.0),
        "urgent_low": 0.1,
        "urgent_high": 20.0,
        "requires_gender": False,
    },
    "serum_potassium": {
        "canonical_name": "Serum Potassium (K+)",
        "aliases": ["serum potassium", "potassium", "k+"],
        "accepted_units": ["mmol/l", "meq/l"],
        "default_range": (3.5, 5.1),
        "urgent_low": 2.8,
        "urgent_high": 6.2,
        "requires_gender": False,
    },
    "serum_sodium": {
        "canonical_name": "Serum Sodium (Na+)",
        "aliases": ["serum sodium", "sodium", "na+"],
        "accepted_units": ["mmol/l", "meq/l"],
        "default_range": (135.0, 145.0),
        "urgent_low": 120.0,
        "urgent_high": 155.0,
        "requires_gender": False,
    },
}


class LabResultInterpretationEngine:
    """
    Safe Laboratory Result Interpretation Engine.
    Evaluates clinical observations against document ranges or curated configurations.
    Enforces strict non-diagnostic plain-language communication.
    """

    def parse_numeric_value(self, value_str: Any) -> Optional[float]:
        """Extract floating-point number from observation string."""
        if value_str is None:
            return None
        if isinstance(value_str, (int, float)):
            return float(value_str)
        # Clean string e.g. "165 mg/dL" or "7.8 %" or "10.2"
        match = re.search(r"[-+]?\d+(?:\.\d+)?", str(value_str).replace(",", ""))
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                return None
        return None

    def parse_reference_range(self, range_str: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
        """
        Parses min and max bounds from reference range strings.
        Supports:
          - '70 - 100' or '70 – 100' or '70 to 100'
          - '< 200' or '<= 200'
          - '> 50' or '>= 50'
          - '4.0 - 5.6 %'
        """
        if not range_str or not str(range_str).strip():
            return (None, None)

        clean = str(range_str).strip().replace(",", "")

        # Less than pattern: e.g. "< 200" or "<= 200"
        less_match = re.search(r"^(?:<|<=|less than)\s*(\d+(?:\.\d+)?)", clean, re.IGNORECASE)
        if less_match:
            try:
                return (0.0, float(less_match.group(1)))
            except ValueError:
                pass

        # Greater than pattern: e.g. "> 50" or ">= 50"
        greater_match = re.search(r"^(?:>|>=|greater than)\s*(\d+(?:\.\d+)?)", clean, re.IGNORECASE)
        if greater_match:
            try:
                return (float(greater_match.group(1)), None)
            except ValueError:
                pass

        # Interval pattern: 'min - max' or 'min to max'
        interval_match = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)", clean, re.IGNORECASE
        )
        if interval_match:
            try:
                return (float(interval_match.group(1)), float(interval_match.group(2)))
            except ValueError:
                pass

        return (None, None)

    def find_curated_config(self, test_name: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Find matching curated reference configuration by aliases."""
        if not test_name:
            return None
        norm_name = test_name.lower().strip()
        for key, conf in CURATED_LAB_REFERENCE_RANGES.items():
            for alias in conf["aliases"]:
                if alias in norm_name:
                    return (key, conf)
        return None

    def interpret_observation(
        self,
        observation: Dict[str, Any],
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Interprets a single laboratory observation with strict safety rules.
        """
        test_name = (observation.get("test_name") or "Unknown Test").strip()
        raw_val = str(observation.get("value") or "").strip()
        numeric_val = observation.get("numeric_value")
        if numeric_val is None:
            numeric_val = self.parse_numeric_value(raw_val)

        unit = (observation.get("unit") or "").strip()
        doc_ref_range = (observation.get("reference_range") or "").strip()
        confidence = float(observation.get("confidence", 0.85))

        patient_gender = None
        patient_age = None
        if patient_context:
            patient_gender = patient_context.get("patient_gender")
            patient_age = patient_context.get("patient_age")

        # 1. Check if Document Reference Range is available and valid
        doc_min, doc_max = self.parse_reference_range(doc_ref_range)
        has_doc_range = (doc_min is not None or doc_max is not None)

        status = ObservationStatus.UNKNOWN
        source = "DOCUMENT_UNSPECIFIED"
        ref_min = None
        ref_max = None
        urgent_low = None
        urgent_high = None
        effective_range_str = doc_ref_range if doc_ref_range else None

        curated_match = self.find_curated_config(test_name)

        if has_doc_range and numeric_val is not None:
            # Rule: Use reference range from document whenever available!
            ref_min = doc_min
            ref_max = doc_max
            source = "DOCUMENT_REFERENCE_RANGE"

            if ref_min is not None and numeric_val < ref_min:
                status = ObservationStatus.LOW
            elif ref_max is not None and numeric_val > ref_max:
                status = ObservationStatus.HIGH
            else:
                status = ObservationStatus.NORMAL

            # Check if curated KB has critical/urgent boundaries for this test
            if curated_match:
                urgent_low = curated_match[1].get("urgent_low")
                urgent_high = curated_match[1].get("urgent_high")

        elif not has_doc_range:
            # Document does NOT contain a reference range:
            # ONLY use curated configuration when:
            # 1. Test is confidently identified (confidence >= 0.8)
            # 2. Unit is known and matches curated configuration
            # 3. Patient context is sufficient
            # 4. Source & version are explicitly recorded
            can_use_curated = False
            curated_key = None
            curated_conf = None

            if curated_match and confidence >= 0.8:
                curated_key, curated_conf = curated_match
                # Check unit
                unit_norm = unit.lower().strip()
                unit_accepted = any(u.lower() == unit_norm for u in curated_conf["accepted_units"])

                # Check patient context sufficiency
                context_sufficient = True
                if curated_conf.get("requires_gender"):
                    # Requires gender or general adult
                    if not patient_gender and not patient_age:
                        context_sufficient = False

                if unit_accepted and context_sufficient:
                    can_use_curated = True

            if can_use_curated and curated_conf and numeric_val is not None:
                # Resolve ranges with gender if available
                if patient_gender and "gender_ranges" in curated_conf and patient_gender in curated_conf["gender_ranges"]:
                    ref_min, ref_max = curated_conf["gender_ranges"][patient_gender]
                else:
                    ref_min, ref_max = curated_conf["default_range"]

                source = f"{CURATED_KB_VERSION} (Curated Clinical Lab Range)"
                effective_range_str = f"{ref_min} - {ref_max} {unit}".strip()
                urgent_low = curated_conf.get("urgent_low")
                urgent_high = curated_conf.get("urgent_high")

                if ref_min is not None and numeric_val < ref_min:
                    status = ObservationStatus.LOW
                elif ref_max is not None and numeric_val > ref_max:
                    status = ObservationStatus.HIGH
                else:
                    status = ObservationStatus.NORMAL
            else:
                # Otherwise return UNKNOWN!
                status = ObservationStatus.UNKNOWN
                source = "DOCUMENT_UNSPECIFIED (Range not in document & context insufficient for curated fallback)"
                effective_range_str = "Not Specified in Report"

        # 2. Determine Severity
        severity = self._determine_severity(
            status=status,
            numeric_val=numeric_val,
            ref_min=ref_min,
            ref_max=ref_max,
            urgent_low=urgent_low,
            urgent_high=urgent_high,
        )

        # 3. Generate Non-Diagnostic Plain-Language Explanation
        explanation = self._generate_explanation(
            test_name=test_name,
            value_str=raw_val,
            numeric_val=numeric_val,
            unit=unit,
            reference_range_str=effective_range_str or "unspecified",
            status=status,
            severity=severity,
            source=source,
        )

        obs_id = observation.get("observation_id") or str(uuid.uuid4())

        return {
            "observation_id": str(obs_id),
            "test_name": test_name,
            "value": raw_val,
            "numeric_value": numeric_val,
            "unit": unit or None,
            "reference_range": effective_range_str,
            "status": status,
            "severity": severity,
            "explanation": explanation,
            "confidence": round(confidence, 2),
            "source": source,
            "reference_min": ref_min,
            "reference_max": ref_max,
        }

    def _determine_severity(
        self,
        status: str,
        numeric_val: Optional[float],
        ref_min: Optional[float],
        ref_max: Optional[float],
        urgent_low: Optional[float],
        urgent_high: Optional[float],
    ) -> str:
        """Determines the clinical review urgency without diagnosing."""
        if status == ObservationStatus.NORMAL:
            return InterpretationSeverity.NORMAL

        if status == ObservationStatus.UNKNOWN:
            return InterpretationSeverity.INFORMATIONAL

        # For HIGH or LOW, check if urgent review threshold is met
        if numeric_val is not None:
            # Explicit panic threshold from curated config
            if urgent_low is not None and numeric_val <= urgent_low:
                return InterpretationSeverity.URGENT_REVIEW
            if urgent_high is not None and numeric_val >= urgent_high:
                return InterpretationSeverity.URGENT_REVIEW

            # Mathematical extreme deviation: e.g. > 2.5x upper limit or < 0.5x lower limit
            if ref_max is not None and ref_max > 0 and numeric_val >= (ref_max * 2.5):
                return InterpretationSeverity.URGENT_REVIEW
            if ref_min is not None and ref_min > 0 and numeric_val <= (ref_min * 0.5):
                return InterpretationSeverity.URGENT_REVIEW

        return InterpretationSeverity.REVIEW_RECOMMENDED

    def _generate_explanation(
        self,
        test_name: str,
        value_str: str,
        numeric_val: Optional[float],
        unit: str,
        reference_range_str: str,
        status: str,
        severity: str,
        source: str,
    ) -> str:
        """
        Generates safe, non-diagnostic, plain-language patient explanations.
        Adheres strictly to clinical guidance: NO fabricated diagnoses or symptoms.
        """
        display_val = f"{value_str} {unit}".strip() if unit else value_str

        if status == ObservationStatus.NORMAL:
            return (
                f"Your {test_name} result of {display_val} is within the reference range "
                f"({reference_range_str}) shown in this report. This represents a normal "
                f"finding according to the reporting laboratory."
            )

        if status == ObservationStatus.HIGH:
            base = (
                f"Your {test_name} value of {display_val} is above the reference range "
                f"({reference_range_str}) shown in this report. Elevated {test_name} can have "
                f"several physiological or clinical causes. Discuss this result with a qualified "
                f"healthcare professional, especially if it is unexpected."
            )
            if severity == InterpretationSeverity.URGENT_REVIEW:
                base += (
                    " NOTE: This value deviates significantly from the expected range. "
                    "Prompt follow-up with your healthcare provider is recommended."
                )
            return base

        if status == ObservationStatus.LOW:
            base = (
                f"Your {test_name} value of {display_val} is below the reference range "
                f"({reference_range_str}) shown in this report. Reduced {test_name} levels can "
                f"be associated with various dietary, physiological, or medical factors. Discuss "
                f"this result with a qualified healthcare professional for clinical correlation."
            )
            if severity == InterpretationSeverity.URGENT_REVIEW:
                base += (
                    " NOTE: This value deviates significantly from the expected range. "
                    "Prompt follow-up with your healthcare provider is recommended."
                )
            return base

        # UNKNOWN status
        return (
            f"The reference range for {test_name} was not explicitly verified from the document "
            f"and could not be inferred with complete confidence. Without an explicit laboratory "
            f"reference interval, clinical significance cannot be evaluated. Please consult your "
            f"physician or referring laboratory."
        )

    def interpret_document_observations(
        self,
        db: Any,
        document_id: Any,
        user_id: Any,
        observations: List[Dict[str, Any]],
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> List[ObservationInterpretation]:
        """
        Interprets a list of laboratory observations for a document, generates safe
        ObservationInterpretation models, and adds them to the database session.
        """
        results: List[ObservationInterpretation] = []
        for obs in observations:
            interp_dict = self.interpret_observation(obs, patient_context=patient_context)
            obs_id = str(obs.get("observation_id") or uuid.uuid4())
            record = ObservationInterpretation(
                document_id=document_id,
                user_id=user_id,
                observation_id=obs_id,
                test_name=interp_dict["test_name"],
                value=interp_dict["value"],
                numeric_value=interp_dict["numeric_value"],
                unit=interp_dict["unit"],
                reference_range=interp_dict["reference_range"],
                status=interp_dict["status"],
                severity=interp_dict["severity"],
                explanation=interp_dict["explanation"],
                confidence=interp_dict["confidence"],
                source=interp_dict["source"],
            )
            db.add(record)
            results.append(record)
        return results


lab_interpretation_engine = LabResultInterpretationEngine()

