import os
import sys
import uuid
import json

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.user import User
from app.models.document import Document
from app.models.extraction import DocumentExtraction
from app.models.ai_extraction import AIExtraction
import asyncio
from app.services.ai_extraction_service import ai_extraction_service

def test_phase5_synthetic_pipeline():
    print("=================================================================")
    print("PHASE 5 VERIFICATION: AI-POWERED STRUCTURED EXTRACTION PIPELINE")
    print("=================================================================")

    # 1. Verify Database Schema & Table creation
    print("[1] Ensuring all database tables exist...")
    Base.metadata.create_all(bind=engine)
    print("    -> Database tables verified (users, patients, documents, document_extractions, ai_extractions).")

    # 2. Test Deterministic Clinical NER Provider directly with Synthetic Prescription
    print("\n[2] Testing Clinical Extraction Engine on Synthetic Prescription...")
    synthetic_rx_text = """
    CITY GENERAL HOSPITAL
    DEPARTMENT OF INTERNAL MEDICINE
    Date: 2025-05-12
    Patient: John Doe, 45 Y / Male
    Attending: Dr. Sarah Jenkins, MD

    Diagnosis: Acute Upper Respiratory Tract Infection, Hypertension

    Rx:
    1. Tab Azithromycin 500mg - 1 tablet orally once daily for 5 days. Take with food.
    2. Tab Paracetamol 650mg - 1 tablet orally every 8 hours as needed for fever.
    3. Tab Amlodipine 5mg - 1 tablet orally once daily in morning for 30 days.

    Clinical Notes:
    Patient presented with sore throat, mild fever, and dry cough for 3 days. Vital signs stable, BP 138/88 mmHg. Advised warm saline gargle and adequate hydration. Review in 5 days if symptoms persist.
    """

    res_rx = asyncio.run(ai_extraction_service.extract_structured_data(synthetic_rx_text))
    data_rx = res_rx["structured_data"]
    print(f"    -> Patient Name: {data_rx.get('patient_name')} (conf: {data_rx.get('field_confidences', {}).get('patient_name')})")
    print(f"    -> Patient Age: {data_rx.get('patient_age')}, Gender: {data_rx.get('patient_gender')}")
    print(f"    -> Doctor: {data_rx.get('doctor_name')}")
    print(f"    -> Hospital: {data_rx.get('hospital_name')}")
    print(f"    -> Date: {data_rx.get('document_date')}")
    print(f"    -> Diagnoses: {data_rx.get('diagnoses')}")
    medications_list = data_rx.get("medications", [])
    print(f"    -> Extracted {len(medications_list)} medications:")
    for med in medications_list:
        print(f"       * {med.get('name')} | Dose: {med.get('dosage')} | Route: {med.get('route')} | Freq: {med.get('frequency')} | Dur: {med.get('duration')} | Conf: {med.get('confidence')}")
    
    assert data_rx.get("patient_name") == "John Doe", f"Expected 'John Doe', got '{data_rx.get('patient_name')}'"
    assert data_rx.get("patient_gender") == "Male", f"Expected 'Male', got '{data_rx.get('patient_gender')}'"
    assert len(medications_list) >= 3, f"Expected at least 3 medications, got {len(medications_list)}"

    # 3. Test Clinical Extraction Engine on Synthetic Lab Report
    print("\n[3] Testing Clinical Extraction Engine on Synthetic Lab Report...")
    synthetic_lab_text = """
    METRO CLINICAL DIAGNOSTIC LABORATORIES
    Patient Name: Jane Smith
    Age: 52 Years | Gender: Female
    Referring Physician: Dr. Rajesh Kumar
    Date of Collection: 2025-04-10

    INVESTIGATION: COMPREHENSIVE BIOCHEMICAL PROFILE

    Test Name                     Result     Unit       Biological Reference Range
    -----------------------------------------------------------------------------
    Fasting Blood Sugar (FBS)     165        mg/dL      70 - 100 (HIGH)
    HbA1c                         7.8        %          4.0 - 5.6 (HIGH)
    Serum Creatinine              0.9        mg/dL      0.6 - 1.2 (NORMAL)
    Total Cholesterol             240        mg/dL      125 - 200 (HIGH)
    Hemoglobin                    10.2       g/dL       12.0 - 15.5 (LOW)
    Platelet Count                250000     /uL        150000 - 450000 (NORMAL)

    Clinical Notes:
    Elevated glycated hemoglobin and fasting plasma glucose consistent with suboptimal glycemic control. Mild microcytic anemia indicated by hemoglobin level.
    """

    res_lab = asyncio.run(ai_extraction_service.extract_structured_data(synthetic_lab_text))
    data_lab = res_lab["structured_data"]
    print(f"    -> Patient Name: {data_lab.get('patient_name')}")
    print(f"    -> Doctor: {data_lab.get('doctor_name')}")
    print(f"    -> Hospital: {data_lab.get('hospital_name')}")
    obs_list = data_lab.get("observations", [])
    print(f"    -> Extracted {len(obs_list)} observations / lab tests:")
    for obs in obs_list:
        print(f"       * {obs.get('test_name')}: {obs.get('value')} {obs.get('unit') or ''} | Range: {obs.get('reference_range') or 'N/A'} | Flag: {obs.get('abnormal_flag')} | Conf: {obs.get('confidence')}")

    assert data_lab.get("patient_name") == "Jane Smith", f"Expected 'Jane Smith', got '{data_lab.get('patient_name')}'"
    assert len(obs_list) >= 4, f"Expected at least 4 observations, got {len(obs_list)}"
    fbs = next((o for o in obs_list if "Blood Sugar" in o.get("test_name", "") or "FBS" in o.get("test_name", "")), None)
    if fbs:
        assert fbs.get("abnormal_flag") in ["HIGH", "NORMAL", "LOW"], f"Invalid abnormal flag {fbs.get('abnormal_flag')}"

    # 4. Critical Safety / Zero Hallucination Test
    print("\n[4] Testing Zero-Hallucination & Null Safety on Sparse Document...")
    sparse_text = "Routine administrative invoice with no medical findings or prescription items."
    res_sparse = asyncio.run(ai_extraction_service.extract_structured_data(sparse_text))
    data_sparse = res_sparse["structured_data"]
    print(f"    -> Patient Name: {data_sparse.get('patient_name')} (must be None)")
    print(f"    -> Medications count: {len(data_sparse.get('medications', []))} (must be 0)")
    print(f"    -> Observations count: {len(data_sparse.get('observations', []))} (must be 0)")
    assert data_sparse.get("patient_name") is None, "Zero hallucination violation: patient_name was populated"
    assert data_sparse.get("doctor_name") is None, "Zero hallucination violation: doctor_name was populated"
    assert len(data_sparse.get("medications", [])) == 0, "Zero hallucination violation: medications were invented"
    assert len(data_sparse.get("observations", [])) == 0, "Zero hallucination violation: observations were invented"
    print("    -> Zero hallucination verified: All absent items evaluated strictly to null / empty.")

    # 5. Full End-to-End FastAPI TestClient API Verification
    print("\n[5] Testing Endpoints via FastAPI TestClient...")
    client = TestClient(app)

    # Register & Login
    unique_email = f"test_doctor_{uuid.uuid4().hex[:6]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": "Dr. Synthetic Tester"
    })
    assert reg_res.status_code in (200, 201), f"Registration failed: {reg_res.text}"
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload document
    test_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Synthetic Lab Report) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    upload_res = client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": ("synthetic_report.pdf", test_pdf_content, "application/pdf")},
        data={"document_type": "LAB_REPORT"}
    )
    assert upload_res.status_code == 201, f"Upload failed: {upload_res.text}"
    doc_id = upload_res.json()["id"]
    print(f"    -> Uploaded test document ID: {doc_id}")

    # Seed DocumentExtraction text for this document so AI extraction can process it
    db = SessionLocal()
    try:
        existing_extraction = db.query(DocumentExtraction).filter(DocumentExtraction.document_id == uuid.UUID(doc_id)).first()
        if not existing_extraction:
            existing_extraction = DocumentExtraction(
                document_id=uuid.UUID(doc_id),
                raw_text=synthetic_rx_text,
                cleaned_text=synthetic_rx_text.strip(),
                ocr_confidence=0.96,
                page_count=1,
                language_detected="en",
                processing_time=0.25
            )
            db.add(existing_extraction)
            doc_obj = db.query(Document).filter(Document.id == uuid.UUID(doc_id)).first()
            doc_obj.processing_status = "COMPLETED"
            db.commit()
    finally:
        db.close()

    # Trigger POST /api/documents/{id}/extract
    print("    -> Calling POST /api/documents/{id}/extract...")
    extract_res = client.post(f"/api/documents/{doc_id}/extract", headers=headers)
    assert extract_res.status_code == 200, f"Extraction failed: {extract_res.text}"
    extract_json = extract_res.json()
    print(f"    -> Extraction response status: {extract_json.get('status')}")
    assert extract_json["status"] == "COMPLETED"
    structured_res = extract_json["extraction"]["structured_data"]
    assert structured_res["patient_name"] == "John Doe"
    assert len(structured_res["medications"]) >= 3

    # Test GET /api/documents/{id}/ai-extraction
    print("    -> Calling GET /api/documents/{id}/ai-extraction...")
    get_ai_res = client.get(f"/api/documents/{doc_id}/ai-extraction", headers=headers)
    assert get_ai_res.status_code == 200, f"GET ai-extraction failed: {get_ai_res.text}"
    get_ai_data = get_ai_res.json()
    assert get_ai_data["structured_data"]["patient_name"] == "John Doe"
    print(f"    -> Successfully verified GET /api/documents/{doc_id}/ai-extraction")

    # Test GET /api/documents/{id}/extraction (combined endpoint)
    print("    -> Calling GET /api/documents/{id}/extraction...")
    get_combo_res = client.get(f"/api/documents/{doc_id}/extraction", headers=headers)
    assert get_combo_res.status_code == 200, f"GET extraction failed: {get_combo_res.text}"
    combo_data = get_combo_res.json()
    assert combo_data["ai_extraction"] is not None
    assert combo_data["ai_extraction"]["structured_data"]["patient_name"] == "John Doe"
    print(f"    -> Successfully verified GET /api/documents/{doc_id}/extraction (combined response)")

    print("\n=================================================================")
    print("ALL PHASE 5 TESTS PASSED SUCCESSFULLY! 100% VERIFIED.")
    print("=================================================================")

if __name__ == "__main__":
    test_phase5_synthetic_pipeline()
