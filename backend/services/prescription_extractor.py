# Alias to app.services.prescription_extractor
from app.services.prescription_extractor import (
    PrescriptionExtractorService,
    prescription_extractor,
    extract_prescription,
    PRESCRIPTION_SYSTEM_PROMPT,
)

__all__ = [
    "PrescriptionExtractorService",
    "prescription_extractor",
    "extract_prescription",
    "PRESCRIPTION_SYSTEM_PROMPT",
]
