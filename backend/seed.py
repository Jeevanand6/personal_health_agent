import os
import sys
import uuid
from datetime import datetime, timedelta, date

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.patient import Patient
from app.models.document import Document
from app.models.ai_extraction import AIExtraction
from app.models.observation_interpretation import ObservationInterpretation
from app.services.lab_interpretation_engine import lab_interpretation_engine
from app.services.health_summary_service import health_summary_service


def seed_database():
    print("=== SEEDING HEALTH COPILOT DATABASE ===")
    db = SessionLocal()
    try:
        # 1. Create or get demo user
        demo_email = "demo@example.com"
        user = db.query(User).filter(User.email == demo_email).first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                email=demo_email,
                hashed_password=get_password_hash("Password123!"),
                full_name="Alex Mercer",
                role="patient",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            patient = Patient(
                id=uuid.uuid4(),
                user_id=user.id,
                abha_id="91-4521-8890-1234",
                abha_address="alex.mercer@abdm",
                gender="Male",
                date_of_birth=date(1982, 6, 15),
                blood_group="O+",
                contact_number="+91 98765 43210",
                preferred_language="en",
            )
            db.add(patient)
            db.commit()
            print(f"Created demo patient: {demo_email}")
        else:
            print(f"Found existing demo user: {demo_email}")

        # 2. Add 3 sequential laboratory diagnostic documents with historical timelines
        dates = [
            (datetime.utcnow() - timedelta(days=90), "Comprehensive Metabolic Panel - Jan 2025"),
            (datetime.utcnow() - timedelta(days=45), "Biochemical Follow-up Report - Mar 2025"),
            (datetime.utcnow() - timedelta(days=5), "Quarterly Health Review Panel - May 2025"),
        ]

        test_progression = [
            # T1: 90 days ago
            [
                {"test_name": "Fasting Blood Sugar", "value": "135", "numeric_value": 135.0, "unit": "mg/dL", "reference_range": "70 - 99"},
                {"test_name": "HbA1c", "value": "7.4", "numeric_value": 7.4, "unit": "%", "reference_range": "4.0 - 5.6"},
                {"test_name": "Hemoglobin", "value": "11.2", "numeric_value": 11.2, "unit": "g/dL", "reference_range": "13.0 - 17.0"},
                {"test_name": "Serum Creatinine", "value": "1.1", "numeric_value": 1.1, "unit": "mg/dL", "reference_range": "0.7 - 1.3"},
                {"test_name": "Total Cholesterol", "value": "242", "numeric_value": 242.0, "unit": "mg/dL", "reference_range": "< 200"},
            ],
            # T2: 45 days ago
            [
                {"test_name": "Fasting Blood Sugar", "value": "122", "numeric_value": 122.0, "unit": "mg/dL", "reference_range": "70 - 99"},
                {"test_name": "HbA1c", "value": "6.8", "numeric_value": 6.8, "unit": "%", "reference_range": "4.0 - 5.6"},
                {"test_name": "Hemoglobin", "value": "12.1", "numeric_value": 12.1, "unit": "g/dL", "reference_range": "13.0 - 17.0"},
                {"test_name": "Serum Creatinine", "value": "1.0", "numeric_value": 1.0, "unit": "mg/dL", "reference_range": "0.7 - 1.3"},
                {"test_name": "Total Cholesterol", "value": "218", "numeric_value": 218.0, "unit": "mg/dL", "reference_range": "< 200"},
            ],
            # T3: 5 days ago
            [
                {"test_name": "Fasting Blood Sugar", "value": "108", "numeric_value": 108.0, "unit": "mg/dL", "reference_range": "70 - 99"},
                {"test_name": "HbA1c", "value": "6.2", "numeric_value": 6.2, "unit": "%", "reference_range": "4.0 - 5.6"},
                {"test_name": "Hemoglobin", "value": "13.4", "numeric_value": 13.4, "unit": "g/dL", "reference_range": "13.0 - 17.0"},
                {"test_name": "Serum Creatinine", "value": "0.9", "numeric_value": 0.9, "unit": "mg/dL", "reference_range": "0.7 - 1.3"},
                {"test_name": "Total Cholesterol", "value": "194", "numeric_value": 194.0, "unit": "mg/dL", "reference_range": "< 200"},
            ],
        ]

        patient_profile = {
            "gender": "male",
            "age": 42,
        }

        for i, (dt, title) in enumerate(dates):
            doc = db.query(Document).filter(
                Document.user_id == user.id,
                Document.original_filename == f"{title}.pdf"
            ).first()

            if not doc:
                doc = Document(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    filename=f"seed_lab_report_{i+1}.pdf",
                    original_filename=f"{title}.pdf",
                    mime_type="application/pdf",
                    file_size=1024 * (150 + i * 20),
                    storage_path=f"/storage_data/seed_lab_report_{i+1}.pdf",
                    document_type="LAB_REPORT",
                    processing_status="INTERPRETED",
                    upload_date=dt,
                    created_at=dt,
                )
                db.add(doc)
                db.flush()

                # Add AIExtraction
                raw_obs_data = []
                for test_item in test_progression[i]:
                    raw_obs_data.append({
                        "test_name": test_item["test_name"],
                        "value": test_item["value"],
                        "numeric_value": test_item["numeric_value"],
                        "unit": test_item["unit"],
                        "reference_range": test_item["reference_range"],
                        "abnormal_flag": "UNKNOWN",
                        "confidence": 0.95,
                    })

                ai_ext = AIExtraction(
                    id=uuid.uuid4(),
                    document_id=doc.id,
                    raw_response="{}",
                    structured_data={
                        "patient_name": "Alex Mercer",
                        "doctor_name": "Dr. Sarah Jenkins, MD",
                        "hospital_name": "Metropolitan Health System",
                        "document_date": dt.strftime("%Y-%m-%d"),
                        "laboratory_tests": [t["test_name"] for t in test_progression[i]],
                        "observations": raw_obs_data,
                    },
                    model_name="gemini-3.8-flash",
                    confidence_score=0.95,
                    processing_time=0.42,
                    created_at=dt,
                )
                db.add(ai_ext)
                db.flush()

                # Run interpretations engine
                results = lab_interpretation_engine.interpret_document_observations(
                    db=db,
                    document_id=doc.id,
                    user_id=user.id,
                    patient_context=patient_profile,
                    observations=raw_obs_data,
                )
                # Align timestamps to historical test dates
                for interp in results:
                    interp.created_at = dt
                    interp.updated_at = dt
                db.commit()
                print(f"Created and interpreted document: {title} ({len(results)} tests)")

        # 3. Add clinical prescription document
        rx_doc = db.query(Document).filter(
            Document.user_id == user.id,
            Document.original_filename == "Prescription_Endocrinology_Followup.pdf"
        ).first()

        if not rx_doc:
            rx_doc = Document(
                id=uuid.uuid4(),
                user_id=user.id,
                filename="prescription_demo_rx.pdf",
                original_filename="Prescription_Endocrinology_Followup.pdf",
                mime_type="application/pdf",
                file_size=10240,
                storage_path="/storage_data/prescription_demo_rx.pdf",
                document_type="PRESCRIPTION",
                processing_status="EXTRACTED",
                upload_date=datetime.utcnow() - timedelta(days=20),
                created_at=datetime.utcnow() - timedelta(days=20),
            )
            db.add(rx_doc)
            db.flush()

            ai_ext = AIExtraction(
                id=uuid.uuid4(),
                document_id=rx_doc.id,
                raw_response="{}",
                structured_data={
                    "patient_name": "Alex Mercer",
                    "doctor_name": "Dr. R. Sundaram, MD",
                    "hospital_name": "Apollo Multispeciality Hospitals",
                    "document_date": (datetime.utcnow() - timedelta(days=20)).strftime("%Y-%m-%d"),
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
                created_at=datetime.utcnow() - timedelta(days=20),
            )
            db.add(ai_ext)
            db.commit()
            print("Created demo prescription record.")

        # 4. Pre-generate Health Summaries in English and Tamil
        summary_en = health_summary_service.generate_health_summary(
            db=db, user_id=user.id, language="en", force_refresh=True
        )
        print("Generated initial English Health Summary.")

        summary_ta = health_summary_service.generate_health_summary(
            db=db, user_id=user.id, language="ta", force_refresh=True
        )
        # 5. Synchronize Unified Timeline Events
        from app.services.timeline_service import timeline_service
        timeline_count = timeline_service.sync_user_timeline(db=db, user_id=user.id)
        print(f"Synchronized {timeline_count} timeline events for demo user.")

        print("=== DATABASE SEEDING COMPLETED SUCCESSFULLY! ===")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
