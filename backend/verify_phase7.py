import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.health_summary import HealthSummary
from app.services.health_summary_service import health_summary_service


def test_phase7():
    print("==================================================")
    print("STARTING PHASE 7 VERIFICATION")
    print("==================================================")

    db = SessionLocal()
    try:
        # 1. Locate Demo User
        demo_user = db.query(User).filter(User.email == "demo@example.com").first()
        assert demo_user is not None, "Demo user demo@example.com should exist in the database!"
        print(f"Found demo user: {demo_user.email} (ID: {demo_user.id})")

        # Check if prescription document exists for demo user, otherwise add one for complete 8-section coverage
        from app.models.document import Document
        from app.models.ai_extraction import AIExtraction
        import uuid

        rx_doc = db.query(Document).filter(
            Document.user_id == demo_user.id,
            Document.original_filename == "Prescription_Endocrinology_Followup.pdf"
        ).first()

        if not rx_doc:
            rx_doc = Document(
                id=uuid.uuid4(),
                user_id=demo_user.id,
                filename="prescription_demo_rx.pdf",
                original_filename="Prescription_Endocrinology_Followup.pdf",
                mime_type="application/pdf",
                file_size=10240,
                storage_path="/storage/prescription_demo_rx.pdf",
                document_type="PRESCRIPTION",
                processing_status="EXTRACTED",
            )
            db.add(rx_doc)
            db.flush()

            ai_ext = AIExtraction(
                id=uuid.uuid4(),
                document_id=rx_doc.id,
                raw_response="{}",
                structured_data={
                    "patient_name": "Demo Patient",
                    "doctor_name": "Dr. R. Sundaram, MD",
                    "hospital_name": "Apollo Multispeciality Hospitals",
                    "document_date": "2026-03-15",
                    "diagnoses": ["Type 2 Diabetes Mellitus", "Dyslipidemia"],
                    "medications": [
                        {
                            "name": "Metformin Hydrochloride",
                            "dosage": "500 mg",
                            "frequency": "Twice daily with meals",
                            "route": "Oral",
                            "instructions": "Take with breakfast and dinner",
                            "confidence": 0.98,
                        },
                        {
                            "name": "Atorvastatin Calcium",
                            "dosage": "10 mg",
                            "frequency": "Once daily at bedtime",
                            "route": "Oral",
                            "instructions": "Take at night",
                            "confidence": 0.95,
                        },
                    ],
                },
                model_name="gemini-3.8-flash",
                confidence_score=0.96,
                processing_time=0.45,
            )
            db.add(ai_ext)
            db.commit()
            print("Seeded demo prescription record with medications and diagnoses.")

        # 2. Test direct service generation in English
        print("\n--- 1. Generating Health Summary (English) ---")
        summary_en = health_summary_service.generate_health_summary(
            db=db, user_id=demo_user.id, language="en", force_refresh=True
        )
        assert summary_en is not None
        assert summary_en.language == "en"
        assert summary_en.model == "health-summary-engine-v1"
        assert summary_en.confidence >= 0.9

        content_en = summary_en.summary
        assert "health_snapshot" in content_en
        assert "recent_medical_records" in content_en
        assert "medications" in content_en
        assert "laboratory_observations" in content_en
        assert "abnormal_results" in content_en
        assert "recent_diagnoses" in content_en
        assert "important_dates" in content_en
        assert "doctor_questions" in content_en
        assert "disclaimer" in content_en
        assert "professional medical advice" in content_en["disclaimer"]

        print(f"Verified all 8 sections in English summary.")
        print(f"Health snapshot headline: {content_en['health_snapshot']['headline']}")
        print(f"Medications count: {len(content_en['medications'])}")
        assert len(content_en["medications"]) >= 2, "Should have medications"
        print(f"Recent diagnoses count: {len(content_en['recent_diagnoses'])}")
        assert len(content_en["recent_diagnoses"]) >= 2, "Should have diagnoses"
        print(f"Lab observations count: {len(content_en['laboratory_observations'])}")
        print(f"Abnormal findings count: {len(content_en['abnormal_results'])}")
        print(f"Doctor questions count: {len(content_en['doctor_questions'])}")

        # Verify traceability of statements and source document IDs
        for ab in content_en["abnormal_results"]:
            assert ab["source_document_id"], "Abnormal result must include source_document_id"
            assert "compared with the reference range" in ab["statement"]
            assert "Discuss this result with your healthcare professional" in ab["action_guidance"]
            # Strict safety check: must NOT claim "You have diabetes" or similar
            assert "You have diabetes" not in ab["statement"]
            assert "You have anemia" not in ab["statement"]
        print("Verified traceability and non-diagnostic phrasing for all abnormal results.")

        # 3. Test direct service generation in Tamil
        print("\n--- 2. Generating Health Summary (Tamil) ---")
        summary_ta = health_summary_service.generate_health_summary(
            db=db, user_id=demo_user.id, language="ta", force_refresh=True
        )
        assert summary_ta is not None
        assert summary_ta.language == "ta"
        content_ta = summary_ta.summary
        assert "மருத்துவ" in content_ta["disclaimer"]
        assert len(content_ta["doctor_questions"]) > 0
        print(f"Verified Tamil summary generated. Doctor questions in Tamil: {len(content_ta['doctor_questions'])}")
        print("Tamil summary content validated successfully without console encoding issue.")

        # 4. Test REST API Endpoints via TestClient
        print("\n--- 3. Testing REST API Endpoints ---")
        client = TestClient(app)

        # Login to get JWT
        login_res = client.post(
            "/api/auth/login",
            json={"email": "demo@example.com", "password": "Password123!"},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # GET /api/health-summary (English)
        get_res_en = client.get("/api/health-summary?language=en", headers=headers)
        assert get_res_en.status_code == 200, f"GET summary failed: {get_res_en.text}"
        data_en = get_res_en.json()
        assert data_en["language"] == "en"
        assert len(data_en["summary"]["doctor_questions"]) > 0
        print(f"GET /api/health-summary?language=en -> HTTP 200 OK")

        # GET /api/health-summary (Tamil)
        get_res_ta = client.get("/api/health-summary?language=ta", headers=headers)
        assert get_res_ta.status_code == 200, f"GET summary ta failed: {get_res_ta.text}"
        data_ta = get_res_ta.json()
        assert data_ta["language"] == "ta"
        print(f"GET /api/health-summary?language=ta -> HTTP 200 OK")

        # POST /api/health-summary/generate
        post_res = client.post(
            "/api/health-summary/generate",
            headers=headers,
            json={"language": "en", "force_refresh": True},
        )
        assert post_res.status_code == 200, f"POST generate failed: {post_res.text}"
        print(f"POST /api/health-summary/generate -> HTTP 200 OK")

        # GET /api/health-summary/history
        hist_res = client.get("/api/health-summary/history", headers=headers)
        assert hist_res.status_code == 200, f"GET history failed: {hist_res.text}"
        hist_items = hist_res.json()
        assert len(hist_items) >= 2, "Should have at least 2 summaries in history"
        print(f"GET /api/health-summary/history -> HTTP 200 OK ({len(hist_items)} snapshots found)")

        print("\n==================================================")
        print("ALL PHASE 7 BACKEND TESTS PASSED SUCCESSFULLY!")
        print("==================================================")
    finally:
        db.close()


if __name__ == "__main__":
    test_phase7()
