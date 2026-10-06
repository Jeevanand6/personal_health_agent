import os
import sys
import uuid
import httpx
from datetime import datetime

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=" * 70)
    print("STARTING COPILOT UPGRADE VERIFICATION SUITE")
    print("=" * 70)

    # 1. Register User A
    user_a_email = f"alice_upgrade_{uuid.uuid4().hex[:6]}@example.com"
    pwd = "TestPassword123!"
    reg_resp = httpx.post(f"{BASE_URL}/api/auth/register", json={
        "email": user_a_email,
        "password": pwd,
        "full_name": "Alice Upgrade",
        "preferred_language": "en"
    })
    assert reg_resp.status_code in [200, 201], f"Register failed: {reg_resp.text}"
    token_a = reg_resp.json()["access_token"]
    user_a_id = reg_resp.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f"[OK] Registered User A ({user_a_email})")

    # Seed User A with test health records directly in DB
    from app.db.session import SessionLocal
    from app.models.document import Document
    from app.models.ai_extraction import AIExtraction
    from app.models.observation_interpretation import ObservationInterpretation
    from app.models.timeline_event import TimelineEvent

    db = SessionLocal()
    try:
        # Document
        doc = Document(
            user_id=uuid.UUID(user_a_id),
            filename="prescription_nov2026.pdf",
            original_filename="prescription_nov2026.pdf",
            storage_path="/mock/path/prescription_nov2026.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="PRESCRIPTION",
            processing_status="PROCESSED"
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # AI Extraction for medications and doctor
        ai_ext = AIExtraction(
            document_id=doc.id,
            structured_data={
                "doctor_name": "Dr. Sarah Jenkins",
                "hospital_name": "Apollo Healthcare",
                "diagnoses": ["Upper Respiratory Tract Infection"],
                "medications": [
                    {"name": "Azithromycin", "dosage": "500mg", "frequency": "Once daily", "duration": "5 days"},
                    {"name": "Paracetamol", "dosage": "650mg", "frequency": "SOS / As needed", "duration": "3 days"}
                ],
            },
            is_verified=True,
            confidence_score=0.98
        )
        db.add(ai_ext)

        # Lab observation for Hb
        obs_hb = ObservationInterpretation(
            observation_id=str(uuid.uuid4()),
            user_id=uuid.UUID(user_a_id),
            document_id=doc.id,
            test_name="Hemoglobin",
            value="9.2",
            unit="g/dL",
            reference_range="12.0 - 15.5",
            status="LOW",
            severity="REVIEW_RECOMMENDED",
            explanation="Hemoglobin is below standard female reference range.",
            source="prescription_nov2026.pdf",
            confidence=0.98
        )
        db.add(obs_hb)

        # Timeline event
        ev = TimelineEvent(
            user_id=uuid.UUID(user_a_id),
            source_document_id=doc.id,
            source_document_title="prescription_nov2026.pdf",
            title="General Physician Consultation",
            event_type="CONSULTATION",
            event_date=datetime(2026, 11, 10, 10, 0),
            description="Consultation with Dr. Sarah Jenkins for respiratory infection."
        )
        db.add(ev)
        db.commit()
        print("[OK] Seeded health records for User A (Dr. Sarah Jenkins, Azithromycin 500mg, Hb 9.2 g/dL)")
    finally:
        db.close()

    # -------------------------------------------------------------
    # TEST 1: GENERAL QUERY - "What is Python?"
    # Must NOT retrieve prescription/document chunks.
    # -------------------------------------------------------------
    print("\n--- TEST 1: GENERAL QUERY ('What is Python?') ---")
    resp1 = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_a, json={
        "message": "Explain Python in simple words.",
        "language": "en"
    }, timeout=30.0)
    assert resp1.status_code == 200, f"Error: {resp1.text}"
    data1 = resp1.json()
    print("Mode:", data1["mode"])
    print("Sources count:", len(data1["sources"]))
    print("Answer snippet:", data1["answer"][:180])
    assert data1["mode"] == "general", f"Expected mode 'general', got {data1['mode']}"
    assert len(data1["sources"]) == 0, f"Expected 0 sources for general query, got {len(data1['sources'])}"
    assert "python" in data1["answer"].lower(), "Answer should explain Python"
    assert "uploaded records" not in data1["answer"].lower(), "Answer must not say 'uploaded records'"
    print("[PASSED] Test 1: General query answered without prescription retrieval or fake sources.")

    # -------------------------------------------------------------
    # TEST 2: GENERAL MEDICAL QUERY - "What is diabetes?"
    # Must NOT retrieve user's prescriptions or personal lab records.
    # -------------------------------------------------------------
    print("\n--- TEST 2: GENERAL MEDICAL QUERY ('What is diabetes?') ---")
    resp2 = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_a, json={
        "message": "What is diabetes?",
        "language": "en"
    }, timeout=30.0)
    assert resp2.status_code == 200, f"Error: {resp2.text}"
    data2 = resp2.json()
    print("Mode:", data2["mode"])
    print("Sources count:", len(data2["sources"]))
    print("Answer snippet:", data2["answer"][:180])
    assert data2["mode"] == "general", f"Expected mode 'general', got {data2['mode']}"
    assert len(data2["sources"]) == 0, "Expected 0 sources for general medical query"
    assert "diabetes" in data2["answer"].lower(), "Answer should explain diabetes"
    assert "azithromycin" not in data2["answer"].lower(), "Must not leak user's azithromycin"
    print("[PASSED] Test 2: General medical question answered without personal health retrieval.")

    # -------------------------------------------------------------
    # TEST 3: PERSONAL HEALTH QUERY - "What medicines did my doctor prescribe?"
    # Must retrieve user's authenticated medications.
    # -------------------------------------------------------------
    print("\n--- TEST 3: PERSONAL HEALTH ('What medicines did my doctor prescribe?') ---")
    resp3 = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_a, json={
        "message": "What medicines did my doctor prescribe?",
        "language": "en"
    }, timeout=30.0)
    assert resp3.status_code == 200, f"Error: {resp3.text}"
    data3 = resp3.json()
    print("Mode:", data3["mode"])
    print("Sources count:", len(data3["sources"]))
    print("Answer snippet:", data3["answer"][:250])
    assert data3["mode"] == "personal_health", f"Expected mode 'personal_health', got {data3['mode']}"
    assert len(data3["sources"]) > 0, "Expected verified sources for personal health query"
    assert "azithromycin" in data3["answer"].lower(), "Must identify Azithromycin"
    print("[PASSED] Test 3: Personal health medications retrieved correctly.")

    # -------------------------------------------------------------
    # TEST 4: PERSONAL HEALTH LAB QUERY - "What is my latest Hb?"
    # -------------------------------------------------------------
    print("\n--- TEST 4: PERSONAL HEALTH LAB ('What is my latest Hb?') ---")
    resp4 = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_a, json={
        "message": "What is my latest Hb?",
        "language": "en"
    }, timeout=30.0)
    assert resp4.status_code == 200, f"Error: {resp4.text}"
    data4 = resp4.json()
    print("Mode:", data4["mode"])
    print("Sources count:", len(data4["sources"]))
    print("Answer snippet:", data4["answer"][:180])
    session_id = data4["session_id"]
    assert data4["mode"] == "personal_health", f"Expected mode 'personal_health', got {data4['mode']}"
    assert "9.2" in data4["answer"], "Must report the recorded 9.2 g/dL value"
    print("[PASSED] Test 4: Recorded Hb observation retrieved.")

    # -------------------------------------------------------------
    # TEST 5: MULTI-TURN FOLLOW-UP - "What does that mean?"
    # Must understand 'that' refers to the Hb result and route to MIXED_HEALTH!
    # -------------------------------------------------------------
    print("\n--- TEST 5: MULTI-TURN FOLLOW-UP ('What does that mean?') ---")
    resp5 = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_a, json={
        "message": "What does that mean?",
        "session_id": session_id,
        "language": "en"
    }, timeout=30.0)
    assert resp5.status_code == 200, f"Error: {resp5.text}"
    data5 = resp5.json()
    print("Mode:", data5["mode"])
    print("Answer snippet:", data5["answer"][:250])
    assert data5["mode"] == "mixed_health", f"Expected mode 'mixed_health', got {data5['mode']}"
    ans5_lower = data5["answer"].lower()
    assert ("hb" in ans5_lower or "hemoglobin" in ans5_lower or "anemia" in ans5_lower or "9.2" in ans5_lower), \
        "Answer must recognize that 'that' refers to the hemoglobin result"
    print("[PASSED] Test 5: Follow-up question correctly resolved to mixed_health with context continuity.")

    # -------------------------------------------------------------
    # TEST 6: MIXED HEALTH QUERY - "What does my Hb result mean?"
    # -------------------------------------------------------------
    print("\n--- TEST 6: MIXED HEALTH ('What does my Hb result mean?') ---")
    resp6 = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_a, json={
        "message": "What does my Hb result mean?",
        "language": "en"
    }, timeout=30.0)
    assert resp6.status_code == 200, f"Error: {resp6.text}"
    data6 = resp6.json()
    print("Mode:", data6["mode"])
    print("Answer snippet:", data6["answer"][:250])
    assert data6["mode"] == "mixed_health", f"Expected mode 'mixed_health', got {data6['mode']}"
    assert "9.2" in data6["answer"], "Should mention the recorded 9.2 value"
    print("[PASSED] Test 6: Mixed health query correctly combines records and medical explanation.")

    # -------------------------------------------------------------
    # TEST 7: CURRENT / REAL-WORLD QUERY - "What is today's weather?"
    # -------------------------------------------------------------
    print("\n--- TEST 7: CURRENT_WEB QUERY ('What is today's weather in Chennai?') ---")
    resp7 = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_a, json={
        "message": "What is today's weather in Chennai?",
        "language": "en"
    }, timeout=30.0)
    assert resp7.status_code == 200, f"Error: {resp7.text}"
    data7 = resp7.json()
    print("Mode:", data7["mode"])
    print("Sources count:", len(data7["sources"]))
    print("Answer snippet:", data7["answer"][:200])
    assert data7["mode"] == "current_web", f"Expected mode 'current_web', got {data7['mode']}"
    assert len(data7["sources"]) > 0, "Should cite live web/weather source"
    print("[PASSED] Test 7: Current web information handled with live web source.")

    # -------------------------------------------------------------
    # TEST 8: MULTI-TENANT ISOLATION (User B cannot access User A's data)
    # -------------------------------------------------------------
    print("\n--- TEST 8: CROSS-USER MULTI-TENANT ISOLATION ---")
    user_b_email = f"bob_upgrade_{uuid.uuid4().hex[:6]}@example.com"
    reg_b = httpx.post(f"{BASE_URL}/api/auth/register", json={
        "email": user_b_email,
        "password": pwd,
        "full_name": "Bob Upgrade",
        "preferred_language": "en"
    })
    assert reg_b.status_code in [200, 201], f"Register B failed: {reg_b.text}"
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    resp_b = httpx.post(f"{BASE_URL}/api/copilot/chat", headers=headers_b, json={
        "message": "What medicines did my doctor prescribe?",
        "language": "en"
    }, timeout=30.0)
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    print("User B Answer snippet:", data_b["answer"][:180])
    assert "azithromycin" not in data_b["answer"].lower(), "CRITICAL: User B must NEVER see User A's medicines!"
    print("[PASSED] Test 8: Multi-tenant isolation verified — User B has zero access to User A's data.")

    # -------------------------------------------------------------
    # TEST 9: API KEY PRIVACY CHECK
    # -------------------------------------------------------------
    print("\n--- TEST 9: API KEY PRIVACY CHECK ---")
    all_responses = [resp1, resp2, resp3, resp4, resp5, resp6, resp7, resp_b]
    for r in all_responses:
        txt = r.text.lower()
        assert "aiza" not in txt, "API Key leak detected in response payload!"
        assert "sk-" not in txt, "OpenAI key leak detected in response payload!"
    print("[PASSED] Test 9: Verified that API keys are NEVER exposed in responses.")

    print("\n" + "=" * 70)
    print("ALL COPILOT UPGRADE END-TO-END VERIFICATION TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
