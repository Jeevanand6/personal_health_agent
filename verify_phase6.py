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
from app.models.observation_interpretation import (
    ObservationInterpretation,
    ObservationStatus,
    InterpretationSeverity,
)
from app.services.lab_interpretation_engine import (
    lab_interpretation_engine,
    CURATED_KB_VERSION,
)


def test_phase6_laboratory_engine():
    print("=================================================================")
    print("PHASE 6 VERIFICATION: SAFE LABORATORY INTERPRETATION ENGINE")
    print("=================================================================")

    # 1. Verify Database Schema & Table creation
    print("[1] Ensuring observation_interpretations table exists...")
    Base.metadata.create_all(bind=engine)
    print("    -> Database schema updated with observation_interpretations table.")

    # 2. Test Document Reference Range Interpretation
    print("\n[2] Testing Interpretation using Document Reference Ranges...")
    obs_high = {
        "test_name": "Fasting Blood Sugar (FBS)",
        "value": "165",
        "numeric_value": 165.0,
        "unit": "mg/dL",
        "reference_range": "70 - 100",
        "confidence": 0.95,
    }
    interp_high = lab_interpretation_engine.interpret_observation(obs_high)
    print(f"    -> High test: {interp_high['test_name']}")
    print(f"       Status: {interp_high['status']} (Expected HIGH)")
    print(f"       Severity: {interp_high['severity']}")
    print(f"       Source: {interp_high['source']}")
    print(f"       Explanation: {interp_high['explanation']}")
    assert interp_high["status"] == "HIGH", f"Expected HIGH, got {interp_high['status']}"
    assert interp_high["source"] == "DOCUMENT_REFERENCE_RANGE"
    assert "diabetes" not in interp_high["explanation"].lower(), "Violation: Diagnosed diabetes!"
    assert "above the reference range" in interp_high["explanation"].lower()

    obs_low = {
        "test_name": "Hemoglobin",
        "value": "10.2",
        "numeric_value": 10.2,
        "unit": "g/dL",
        "reference_range": "12.0 - 15.5",
        "confidence": 0.95,
    }
    interp_low = lab_interpretation_engine.interpret_observation(obs_low)
    print(f"\n    -> Low test: {interp_low['test_name']}")
    print(f"       Status: {interp_low['status']} (Expected LOW)")
    print(f"       Severity: {interp_low['severity']}")
    print(f"       Explanation: {interp_low['explanation']}")
    assert interp_low["status"] == "LOW"
    assert "anemia" not in interp_low["explanation"].lower(), "Violation: Diagnosed anemia!"
    assert "below the reference range" in interp_low["explanation"].lower()

    obs_norm = {
        "test_name": "Serum Creatinine",
        "value": "0.9",
        "numeric_value": 0.9,
        "unit": "mg/dL",
        "reference_range": "0.6 - 1.2",
        "confidence": 0.95,
    }
    interp_norm = lab_interpretation_engine.interpret_observation(obs_norm)
    print(f"\n    -> Normal test: {interp_norm['test_name']}")
    print(f"       Status: {interp_norm['status']} (Expected NORMAL)")
    print(f"       Severity: {interp_norm['severity']} (Expected NORMAL)")
    assert interp_norm["status"] == "NORMAL"
    assert interp_norm["severity"] == "NORMAL"

    # 3. Test Urgent Review Panic Thresholds
    print("\n[3] Testing Urgent Review Thresholds...")
    obs_urgent = {
        "test_name": "Glucose Random",
        "value": "380",
        "numeric_value": 380.0,
        "unit": "mg/dL",
        "reference_range": "70 - 140",
        "confidence": 0.95,
    }
    interp_urgent = lab_interpretation_engine.interpret_observation(obs_urgent)
    print(f"    -> Panic value test: {interp_urgent['test_name']} = {interp_urgent['value']}")
    print(f"       Status: {interp_urgent['status']}")
    print(f"       Severity: {interp_urgent['severity']} (Expected URGENT_REVIEW)")
    assert interp_urgent["severity"] == "URGENT_REVIEW"
    assert "NOTE: This value deviates significantly" in interp_urgent["explanation"]

    # 4. Test Curated Fallback ONLY when conditions 1-4 are met, and UNKNOWN otherwise
    print("\n[4] Testing Fallback Rules (Doc Range Missing)...")
    # Case A: Unknown test without doc range -> UNKNOWN
    obs_unknown = {
        "test_name": "Custom Proprietary Compound Marker",
        "value": "45.2",
        "numeric_value": 45.2,
        "unit": "units",
        "reference_range": None,
        "confidence": 0.85,
    }
    interp_unknown = lab_interpretation_engine.interpret_observation(obs_unknown)
    print(f"    -> Case A (Unverified marker, no doc range): Status = {interp_unknown['status']}")
    assert interp_unknown["status"] == "UNKNOWN"
    assert interp_unknown["severity"] == "INFORMATIONAL"
    assert "not explicitly verified" in interp_unknown["explanation"]

    # Case B: Confidently identified test with verified unit and adult patient context -> Curated range used with recorded source
    obs_curated = {
        "test_name": "Fasting Blood Sugar",
        "value": "88",
        "numeric_value": 88.0,
        "unit": "mg/dL",
        "reference_range": None,
        "confidence": 0.95,
    }
    interp_curated = lab_interpretation_engine.interpret_observation(
        obs_curated, patient_context={"patient_age": "45 Years", "patient_gender": "Male"}
    )
    print(f"    -> Case B (Fasting Blood Sugar with verified context): Status = {interp_curated['status']}")
    print(f"       Source: {interp_curated['source']}")
    assert interp_curated["status"] == "NORMAL"
    assert CURATED_KB_VERSION in interp_curated["source"]

    # 5. Full End-to-End API Endpoints Verification via FastAPI TestClient
    print("\n[5] Testing Endpoints via FastAPI TestClient...")
    client = TestClient(app)

    unique_email = f"lab_doc_{uuid.uuid4().hex[:6]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": "Dr. Laboratory Evaluator"
    })
    assert reg_res.status_code in (200, 201), f"Register failed: {reg_res.text}"
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload sample lab report
    test_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Synthetic Lab Report) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    upload_res = client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": ("lab_report.pdf", test_pdf_content, "application/pdf")},
        data={"document_type": "LAB_REPORT"}
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Seed AI Extraction with observations
    db = SessionLocal()
    try:
        ai_ext = AIExtraction(
            document_id=uuid.UUID(doc_id),
            raw_response="{}",
            structured_data={
                "patient_name": "Jane M. Smith",
                "patient_age": "52 Years",
                "patient_gender": "Female",
                "doctor_name": "Dr. Rajesh Kumar",
                "hospital_name": "Metro Diagnostics",
                "observations": [
                    {
                        "test_name": "Fasting Blood Sugar (FBS)",
                        "value": "165",
                        "numeric_value": 165.0,
                        "unit": "mg/dL",
                        "reference_range": "70 - 100",
                        "abnormal_flag": "HIGH",
                        "confidence": 0.95,
                    },
                    {
                        "test_name": "HbA1c",
                        "value": "7.8",
                        "numeric_value": 7.8,
                        "unit": "%",
                        "reference_range": "4.0 - 5.6",
                        "abnormal_flag": "HIGH",
                        "confidence": 0.95,
                    },
                    {
                        "test_name": "Hemoglobin",
                        "value": "10.2",
                        "numeric_value": 10.2,
                        "unit": "g/dL",
                        "reference_range": "12.0 - 15.5",
                        "abnormal_flag": "LOW",
                        "confidence": 0.95,
                    },
                    {
                        "test_name": "Serum Creatinine",
                        "value": "0.9",
                        "numeric_value": 0.9,
                        "unit": "mg/dL",
                        "reference_range": "0.6 - 1.2",
                        "abnormal_flag": "NORMAL",
                        "confidence": 0.95,
                    },
                ]
            },
            model_name="test-model",
            confidence_score=0.95,
            processing_time=0.1
        )
        db.add(ai_ext)
        doc_obj = db.query(Document).filter(Document.id == uuid.UUID(doc_id)).first()
        doc_obj.processing_status = "COMPLETED"
        db.commit()
    finally:
        db.close()

    # Call POST /api/documents/{id}/interpret
    print("    -> Calling POST /api/documents/{id}/interpret...")
    interp_post_res = client.post(f"/api/documents/{doc_id}/interpret", headers=headers)
    assert interp_post_res.status_code == 200, f"Interpret trigger failed: {interp_post_res.text}"
    interp_json = interp_post_res.json()
    print(f"    -> Interpreted {interp_json['total_interpreted']} observations")
    assert interp_json["total_interpreted"] == 4

    # Call GET /api/documents/{id}/interpretations
    print("    -> Calling GET /api/documents/{id}/interpretations...")
    interp_get_res = client.get(f"/api/documents/{doc_id}/interpretations", headers=headers)
    assert interp_get_res.status_code == 200
    interp_get_data = interp_get_res.json()
    assert interp_get_data["total"] == 4
    assert interp_get_data["summary"]["HIGH"] == 2
    assert interp_get_data["summary"]["LOW"] == 1
    assert interp_get_data["summary"]["NORMAL"] == 1

    # Call GET /api/lab/dashboard
    print("    -> Calling GET /api/lab/dashboard...")
    dash_res = client.get("/api/lab/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    print(f"    -> Dashboard Total Tests: {dash_data['total_tests']}")
    print(f"    -> Dashboard Normal: {dash_data['normal_count']}, Review Rec: {dash_data['review_recommended_count']}")
    print(f"    -> Trends series count: {len(dash_data['trends'])}")
    assert dash_data["total_tests"] == 4
    assert len(dash_data["trends"]) >= 4

    # Call GET /api/lab/trends
    print("    -> Calling GET /api/lab/trends...")
    trends_res = client.get("/api/lab/trends", headers=headers)
    assert trends_res.status_code == 200
    trends_data = trends_res.json()
    assert len(trends_data) >= 4

    print("\n=================================================================")
    print("ALL PHASE 6 TESTS PASSED SUCCESSFULLY! 100% VERIFIED.")
    print("=================================================================")


if __name__ == "__main__":
    test_phase6_laboratory_engine()
