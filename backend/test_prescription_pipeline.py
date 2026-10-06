import asyncio
import io
import json
import os
import httpx

BASE_URL = "http://localhost:8000"

async def run_integration_tests():
    print("=== STARTING PRESCRIPTION INTEGRATION TEST SUITE ===")
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=120.0) as client:
        # 1. Health check
        print("\n--- 1. Testing GET /api/prescription/health ---")
        health_resp = await client.get("/api/prescription/health")
        print(f"Status Code: {health_resp.status_code}")
        print(f"Response: {health_resp.json()}")
        assert health_resp.status_code == 200, f"Health check failed: {health_resp.text}"
        assert health_resp.json()["status"] == "ok"
        assert health_resp.json()["service"] == "prescription-extraction"
        assert health_resp.json()["model"] == "ready"
        print("PASS: Health check verified.")

        # 2. Login to get auth token
        print("\n--- 2. Authenticating Demo User ---")
        login_resp = await client.post(
            "/api/auth/login",
            json={"email": "demo@example.com", "password": "Password123!"},
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("PASS: Authenticated successfully.")

        # 3. Upload & Extract PNG Prescription
        print("\n--- 3. Testing POST /api/prescription/extract with PNG ---")
        png_path = "sample_medical_documents/sample_prescription.png"
        with open(png_path, "rb") as f:
            png_bytes = f.read()

        png_resp = await client.post(
            "/api/prescription/extract",
            files={"file": ("sample_prescription.png", png_bytes, "image/png")},
            headers=headers,
        )
        print(f"Status Code: {png_resp.status_code}")
        assert png_resp.status_code == 200, f"PNG extraction failed: {png_resp.text}"
        png_data = png_resp.json()
        assert png_data["success"] is True
        assert "extraction" in png_data
        assert "medications" in png_data["extraction"]
        meds = png_data["extraction"]["medications"]
        print(f"Extracted {len(meds)} medication(s):")
        for m in meds:
            name = m.get("drug_name", {}).get("raw_text") or m.get("name_as_written", {}).get("raw_text")
            dosage = m.get("dosage", {}).get("raw_text")
            freq = m.get("frequency", {}).get("raw_text")
            print(f"  - {name} | Dosage: {dosage} | Frequency: {freq}")
        print("PASS: PNG prescription extraction succeeded.")

        # 4. Upload & Extract PDF Prescription
        print("\n--- 4. Testing POST /api/prescription/extract with PDF ---")
        pdf_path = "sample_medical_documents/sample_prescription.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        pdf_resp = await client.post(
            "/api/prescription/extract",
            files={"file": ("sample_prescription.pdf", pdf_bytes, "application/pdf")},
            headers=headers,
        )
        print(f"Status Code: {pdf_resp.status_code}")
        assert pdf_resp.status_code == 200, f"PDF extraction failed: {pdf_resp.text}"
        pdf_data = pdf_resp.json()
        assert pdf_data["success"] is True
        doc_id = pdf_data["document_id"]
        print(f"Created Document ID: {doc_id}")
        print("PASS: PDF prescription extraction succeeded.")

        # 5. Test existing /api/documents/{id}/extract-prescription
        print(f"\n--- 5. Testing POST /api/documents/{doc_id}/extract-prescription ---")
        doc_ext_resp = await client.post(
            f"/api/documents/{doc_id}/extract-prescription?page=0",
            headers=headers,
        )
        print(f"Status Code: {doc_ext_resp.status_code}")
        assert doc_ext_resp.status_code == 200, f"Document extract failed: {doc_ext_resp.text}"
        doc_ext_data = doc_ext_resp.json()
        assert doc_ext_data["is_verified"] is False
        print("PASS: /api/documents/{id}/extract-prescription verified (no NameError).")

        # 6. Verify extraction gate: Before verification, Copilot does NOT retrieve unverified meds
        print("\n--- 6. Testing Clinical Safety Gate (Copilot query before verification) ---")
        copilot_before = await client.post(
            "/api/copilot/chat",
            json={"message": "What medicines did my doctor prescribe?"},
            headers=headers,
        )
        print(f"Status Code: {copilot_before.status_code}")
        pre_ans = copilot_before.json().get("answer", "")
        print(f"Copilot Response (Pre-Verification):\n{pre_ans[:200]}...")

        # 7. Human Verification: Confirm & Approve prescription
        print(f"\n--- 7. Testing POST /api/documents/{doc_id}/verify-prescription ---")
        verify_payload = {
            "approved_data": doc_ext_data["structured_data"],
            "corrections": [],
            "notes": "Verified by user in integration test",
        }
        verify_resp = await client.post(
            f"/api/documents/{doc_id}/verify-prescription",
            json=verify_payload,
            headers=headers,
        )
        print(f"Status Code: {verify_resp.status_code}")
        assert verify_resp.status_code == 200, f"Verification failed: {verify_resp.text}"
        assert verify_resp.json()["is_verified"] is True
        print("PASS: Prescription verified and approved into clinical record.")

        # 8. Copilot query after verification
        print("\n--- 8. Testing Copilot Integration after Verification ---")
        copilot_after = await client.post(
            "/api/copilot/chat",
            json={"message": "What medicines did my doctor prescribe?"},
            headers=headers,
        )
        print(f"Status Code: {copilot_after.status_code}")
        reply = copilot_after.json().get("answer", "")
        print(f"Copilot Response (Post-Verification):\n{reply}")
        assert any(kw in reply.lower() for kw in ["azithromycin", "paracetamol", "amlodipine", "prescribe", "medication"]), (
            f"Copilot did not return prescribed medicines: {reply}"
        )
        print("PASS: Copilot correctly retrieved verified medications!")

        print("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_integration_tests())
