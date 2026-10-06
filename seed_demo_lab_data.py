import os
import sys
import uuid
from datetime import datetime, timedelta, date

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.patient import Patient
from app.models.document import Document
from app.models.ai_extraction import AIExtraction
from app.models.observation_interpretation import ObservationInterpretation
from app.services.lab_interpretation_engine import lab_interpretation_engine

def seed_demo_data():
    db = SessionLocal()
    try:
        # 1. Create or get demo user
        demo_email = "demo@example.com"
        user = db.query(User).filter(User.email == demo_email).first()
        if not user:
            user = User(
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

        # 2. Add 3 sequential diagnostic documents with historical timelines
        dates = [
            (datetime.utcnow() - timedelta(days=90), "Comprehensive Metabolic Panel - Jan 2025"),
            (datetime.utcnow() - timedelta(days=45), "Biochemical Follow-up Report - Mar 2025"),
            (datetime.utcnow() - timedelta(days=5), "Quarterly Health Review Panel - May 2025"),
        ]

        test_values_over_time = [
            # T1 (90 days ago)
            [
                ("Fasting Blood Sugar (FBS)", "175", 175.0, "mg/dL", "70 - 100"),
                ("HbA1c", "8.2", 8.2, "%", "4.0 - 5.6"),
                ("Serum Creatinine", "0.9", 0.9, "mg/dL", "0.6 - 1.2"),
                ("Total Cholesterol", "250", 250.0, "mg/dL", "125 - 200"),
                ("Hemoglobin", "10.0", 10.0, "g/dL", "12.0 - 15.5"),
            ],
            # T2 (45 days ago)
            [
                ("Fasting Blood Sugar (FBS)", "158", 158.0, "mg/dL", "70 - 100"),
                ("HbA1c", "7.6", 7.6, "%", "4.0 - 5.6"),
                ("Serum Creatinine", "1.0", 1.0, "mg/dL", "0.6 - 1.2"),
                ("Total Cholesterol", "230", 230.0, "mg/dL", "125 - 200"),
                ("Hemoglobin", "10.8", 10.8, "g/dL", "12.0 - 15.5"),
            ],
            # T3 (5 days ago)
            [
                ("Fasting Blood Sugar (FBS)", "138", 138.0, "mg/dL", "70 - 100"),
                ("HbA1c", "6.9", 6.9, "%", "4.0 - 5.6"),
                ("Serum Creatinine", "0.9", 0.9, "mg/dL", "0.6 - 1.2"),
                ("Total Cholesterol", "210", 210.0, "mg/dL", "125 - 200"),
                ("Hemoglobin", "11.8", 11.8, "g/dL", "12.0 - 15.5"),
            ],
        ]

        total_inserted = 0

        for idx, (doc_date, title) in enumerate(dates):
            # Create Document record
            doc = Document(
                user_id=user.id,
                filename=f"lab_report_t{idx+1}.pdf",
                original_filename=f"{title}.pdf",
                mime_type="application/pdf",
                file_size=10240,
                storage_path=os.path.abspath(f"sample_medical_documents/sample_lab_report.pdf"),
                document_type="LAB_REPORT",
                processing_status="COMPLETED",
                upload_date=doc_date,
                created_at=doc_date,
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            # Insert interpretations for this document
            observations = test_values_over_time[idx]
            for test_name, val_str, num_val, unit, ref_range in observations:
                obs_dict = {
                    "observation_id": f"{doc.id}_{test_name}",
                    "test_name": test_name,
                    "value": val_str,
                    "numeric_value": num_val,
                    "unit": unit,
                    "reference_range": ref_range,
                    "confidence": 0.95,
                }
                interp = lab_interpretation_engine.interpret_observation(
                    obs_dict,
                    patient_context={"patient_gender": "Male", "patient_age": "43 Years"}
                )

                interp_rec = ObservationInterpretation(
                    observation_id=f"{doc.id}_{test_name}",
                    document_id=doc.id,
                    user_id=user.id,
                    test_name=test_name,
                    value=val_str,
                    numeric_value=num_val,
                    unit=unit,
                    reference_range=ref_range,
                    status=interp["status"],
                    severity=interp["severity"],
                    explanation=interp["explanation"],
                    confidence=interp["confidence"],
                    source=interp["source"],
                    created_at=doc_date,
                    updated_at=doc_date,
                )
                db.add(interp_rec)
                total_inserted += 1

            db.commit()

        print(f"Successfully seeded {total_inserted} historical lab interpretations for demo user '{demo_email}'.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_data()
