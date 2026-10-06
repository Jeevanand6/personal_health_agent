"""
Verification script for Phase 9: Bilingual English & Tamil localization and medical invariance.
"""
import sys
import os
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath("backend"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.db.session import SessionLocal
from app.models.user import User
from app.models.patient import Patient
from app.models.document import Document
from app.models.observation_interpretation import ObservationInterpretation
from app.services.health_summary_service import health_summary_service


def test_phase9():
    print("=" * 60)
    print("PHASE 9 VERIFICATION: BILINGUAL LOCALIZATION & MEDICAL INVARIANCE")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 1. Fetch demo user
        demo_user = db.query(User).filter(User.email == "demo@example.com").first()
        assert demo_user is not None, "Demo user demo@example.com not found!"
        patient = db.query(Patient).filter(Patient.user_id == demo_user.id).first()
        assert patient is not None, "Patient record for demo user not found!"
        print(f"Verified Patient Profile: {demo_user.full_name} ({patient.abha_id})")

        # 2. Test English Health Summary Generation
        print("\n--- Testing English Health Summary Generation ---")
        summary_en = health_summary_service.generate_health_summary(
            db, user_id=demo_user.id, language="en", force_refresh=True
        )
        assert summary_en.language == "en"
        content_en = summary_en.summary
        
        # Verify 8 sections are present
        section_keys = [
            "health_snapshot",
            "recent_medical_records",
            "medications",
            "laboratory_observations",
            "abnormal_results",
            "recent_diagnoses",
            "important_dates",
            "doctor_questions",
        ]
        for key in section_keys:
            assert key in content_en, f"Missing section '{key}' in English summary"
        print(f"Verified all 8 required sections present in English summary.")

        abnormal_en = content_en.get("abnormal_results", [])
        print(f"English Abnormal Results count: {len(abnormal_en)}")
        for item in abnormal_en[:3]:
            print(f"  • {item.get('test_name')}: {item.get('statement')}")

        # 3. Test Tamil Health Summary Generation
        print("\n--- Testing Tamil Health Summary Generation ---")
        summary_ta = health_summary_service.generate_health_summary(
            db, user_id=demo_user.id, language="ta", force_refresh=True
        )
        assert summary_ta.language == "ta"
        content_ta = summary_ta.summary

        for key in section_keys:
            assert key in content_ta, f"Missing section '{key}' in Tamil summary"
        print(f"Verified all 8 required sections present in Tamil summary.")

        abnormal_ta = content_ta.get("abnormal_results", [])
        print(f"Tamil Abnormal Results count: {len(abnormal_ta)}")
        for item in abnormal_ta[:3]:
            print(f"  • {item.get('test_name')}: {item.get('statement')}")

        # 4. Verify Exact Hemoglobin Sentence and Medical Invariance
        required_ta_phrase = "உங்கள் அறிக்கையில் குறிப்பிடப்பட்டுள்ள இயல்பான வரம்பை விட ஹீமோகுளோபின் அளவு குறைவாக உள்ளது"
        required_en_phrase = "Your hemoglobin value is below the reference range shown in the report"

        # Check if any item contains the exact expected phrase
        found_ta_match = any(required_ta_phrase in item.get("statement", "") for item in abnormal_ta)
        found_en_match = any(required_en_phrase in item.get("statement", "") for item in abnormal_en)

        print(f"\nExact English Hemoglobin Phrase Match: {found_en_match}")
        print(f"Exact Tamil Hemoglobin Phrase Match: {found_ta_match}")
        assert found_en_match, f"Required English phrase not found: '{required_en_phrase}'"
        assert found_ta_match, f"Required Tamil phrase not found: '{required_ta_phrase}'"

        # 5. Verify Medical Numerical & Unit Invariance
        # Check that units like 'g/dL', numbers like '11.8', '10.8' appear identically in both English and Tamil
        for item_en in abnormal_en:
            if "hemoglobin" in item_en.get("test_name", "").lower():
                hgb_en = item_en
                # find matching in Tamil by same source document
                hgb_ta = next(
                    (
                        it for it in abnormal_ta
                        if "hemoglobin" in it.get("test_name", "").lower()
                        and it.get("source_document_id") == item_en.get("source_document_id")
                    ),
                    None,
                )
                assert hgb_ta is not None, "Matching Hemoglobin not found in Tamil abnormal items"
                print(f"Hgb EN value: {hgb_en['value']}, unit: {hgb_en['unit']}")
                print(f"Hgb TA value: {hgb_ta['value']}, unit: {hgb_ta['unit']}")
                assert hgb_en["value"] == hgb_ta["value"], f"Numerical values do not match: {hgb_en['value']} vs {hgb_ta['value']}"
                assert hgb_en["unit"] == hgb_ta["unit"], f"Units do not match: {hgb_en['unit']} vs {hgb_ta['unit']}"
                print(f"Verified Hemoglobin Numerical & Unit Invariance:")
                print(f"  EN Statement: {hgb_en['statement']}")
                print(f"  TA Statement: {hgb_ta['statement']}")

        # 6. Verify Doctor Discussion Questions
        questions_en = content_en.get("doctor_questions", [])
        questions_ta = content_ta.get("doctor_questions", [])
        print(f"\nEnglish Doctor Discussion Questions: {len(questions_en)}")
        for q in questions_en[:2]:
            print(f"  ? {q.get('question')}")
        print(f"Tamil Doctor Discussion Questions: {len(questions_ta)}")
        for q in questions_ta[:2]:
            print(f"  ? {q.get('question')}")

        # 7. Verify Disclaimer
        assert "This summary is for informational purposes" in content_en.get("disclaimer", "")
        assert "இந்த சுருக்கம் தகவல் நோக்கங்களுக்காக மட்டுமே" in content_ta.get("disclaimer", "")
        print("\nVerified Clinical Disclaimers in both languages.")

        print("\n" + "=" * 60)
        print("ALL PHASE 9 VERIFICATIONS PASSED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    test_phase9()
