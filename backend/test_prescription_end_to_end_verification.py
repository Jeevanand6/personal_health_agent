import asyncio
import io
import json
import os
import sys
import httpx

BASE_URL = "http://localhost:8000"

async def main():
    print("=================================================================")
    print("  PRESCRIPTION EXTRACTION END-TO-END VERIFICATION SUITE")
    print("=================================================================")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=120.0) as client:
        # Step 1: Health check
        print("\n[Step 1] Checking /api/prescription/health...")
        health_resp = await client.get("/api/prescription/health")
        print(f"Status: {health_resp.status_code}, Body: {health_resp.json()}")
        assert health_resp.status_code == 200, f"Health check failed: {health_resp.text}"
        health_json = health_resp.json()
        assert health_json.get("status") == "ok", "Status not ok"
        print("✓ Health check PASSED")

        # Step 2: Authenticate
        print("\n[Step 2] Authenticating demo user...")
        login_resp = await client.post(
            "/api/auth/login",
            json={"email": "demo@example.com", "password": "Password123!"},
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✓ Authenticated successfully with token")

        # Step 3: Direct upload to /api/prescription/extract with sample_prescription.png
        print("\n[Step 3] Testing POST /api/prescription/extract with real prescription image...")
        png_path = "/app/sample_medical_documents/sample_prescription.png"
        if not os.path.exists(png_path):
            png_path = "sample_medical_documents/sample_prescription.png"
        
        with open(png_path, "rb") as f:
            png_bytes = f.read()

        extract_direct_resp = await client.post(
            "/api/prescription/extract",
            files={"file": ("sample_prescription.png", png_bytes, "image/png")},
            headers=headers,
        )
        print(f"Status: {extract_direct_resp.status_code}")
        assert extract_direct_resp.status_code == 200, f"Direct extract failed: {extract_direct_resp.text}"
        direct_data = extract_direct_resp.json()
        assert direct_data["success"] is True
        print(f"Extraction Model: {direct_data.get('model')}")
        print(f"Preprocessing applied: {direct_data.get('preprocessing', {}).get('steps_applied')}")
        ext_result = direct_data.get("extraction", {})
        
        # Verify required fields
        print("\n[Step 3b] Verifying required structured fields...")
        doc_name = ext_result.get("doctor_name", {})
        patient_name = ext_result.get("patient_name", {})
        rx_date = ext_result.get("prescription_date", {})
        meds = ext_result.get("medications", [])
        
        print(f"  Doctor Name: {doc_name.get('raw_text') or doc_name.get('normalized_value')}")
        print(f"  Patient Name: {patient_name.get('raw_text') or patient_name.get('normalized_value')}")
        print(f"  Prescription Date: {rx_date.get('raw_text') or rx_date.get('normalized_value')}")
        print(f"  Total Medications Extracted: {len(meds)}")
        assert len(meds) >= 1, "Expected at least 1 medication to be extracted"
        
        for idx, m in enumerate(meds, 1):
            name = m.get("drug_name", {}).get("raw_text") or m.get("name_as_written", {}).get("raw_text")
            dosage = m.get("dosage", {}).get("raw_text")
            freq = m.get("frequency", {}).get("raw_text")
            duration = m.get("duration", {}).get("raw_text")
            instr = m.get("instructions", {}).get("raw_text")
            uncertain = m.get("is_uncertain", False)
            print(f"  [{idx}] {name}")
            print(f"      Dosage: {dosage} | Frequency: {freq} | Duration: {duration}")
            print(f"      Instructions: {instr} | Uncertain: {uncertain}")
        print("✓ Direct prescription extraction PASSED")

        # Step 4: Standard document upload through document repository
        print("\n[Step 4] Testing document upload -> POST /api/documents/upload...")
        upload_resp = await client.post(
            "/api/documents/upload",
            data={"document_type": "PRESCRIPTION"},
            files={"file": ("rx_test_run.png", png_bytes, "image/png")},
            headers=headers,
        )
        print(f"Status: {upload_resp.status_code}")
        assert upload_resp.status_code == 201, f"Upload failed: {upload_resp.text}"
        doc_id = upload_resp.json()["id"]
        print(f"✓ Uploaded document ID: {doc_id}")

        # Step 5: Test preview endpoint with query param token (browser image tag simulation)
        print("\n[Step 5] Testing GET /api/documents/{doc_id}/prescription-page-preview?token=... without Auth header...")
        preview_resp = await client.get(
            f"/api/documents/{doc_id}/prescription-page-preview?page=0&token={token}"
        )
        print(f"Status: {preview_resp.status_code}, Content-Type: {preview_resp.headers.get('content-type')}, Length: {len(preview_resp.content)} bytes")
        assert preview_resp.status_code == 200, f"Preview failed: {preview_resp.text}"
        assert "image" in preview_resp.headers.get("content-type", ""), "Preview returned non-image content"
        print("✓ Browser query-token image preview PASSED (No 401 Unauthorized)")

        # Step 6: Test POST /api/documents/{doc_id}/extract (The UI 'Run AI Extraction' button)
        print(f"\n[Step 6] Testing POST /api/documents/{doc_id}/extract (UI 'Run AI Extraction' button)...")
        extract_button_resp = await client.post(
            f"/api/documents/{doc_id}/extract",
            headers=headers,
        )
        print(f"Status: {extract_button_resp.status_code}")
        assert extract_button_resp.status_code == 200, f"Extract button failed: {extract_button_resp.text}"
        btn_data = extract_button_resp.json()
        assert btn_data.get("status") in ["COMPLETED", "LOW_CONFIDENCE"], f"Unexpected status: {btn_data.get('status')}"
        assert "extraction" in btn_data and btn_data["extraction"] is not None
        btn_ext = btn_data["extraction"]
        print(f"  Model: {btn_ext.get('model_name')}")
        print(f"  Confidence: {btn_ext.get('confidence_score')}")
        print(f"  Extracted structured_data keys: {list(btn_ext.get('structured_data', {}).keys())}")
        print("✓ POST /api/documents/{doc_id}/extract PASSED with valid AIExtractTriggerResponse")

        # Step 7: Test POST /api/documents/{doc_id}/extract-prescription?page=0 (The Prescription Verification View)
        print(f"\n[Step 7] Testing POST /api/documents/{doc_id}/extract-prescription?page=0...")
        rx_view_resp = await client.post(
            f"/api/documents/{doc_id}/extract-prescription?page=0",
            headers=headers,
        )
        print(f"Status: {rx_view_resp.status_code}")
        assert rx_view_resp.status_code == 200, f"Prescription view extraction failed: {rx_view_resp.text}"
        rx_view_data = rx_view_resp.json()
        assert rx_view_data["is_verified"] is False, "Extraction must be unverified initially"
        assert len(rx_view_data["structured_data"]["medications"]) >= 1
        print(f"  Model: {rx_view_data.get('model_name')}")
        print(f"  Medications found: {len(rx_view_data['structured_data']['medications'])}")
        print("✓ POST /api/documents/{doc_id}/extract-prescription PASSED")

        # Step 8: Human verification workflow
        print(f"\n[Step 8] Testing human verification approval POST /api/documents/{doc_id}/verify-prescription...")
        verify_payload = {
            "approved_data": rx_view_data["structured_data"],
            "corrections": [],
            "notes": "Verified by doctor/patient in verification view",
        }
        verify_resp = await client.post(
            f"/api/documents/{doc_id}/verify-prescription",
            json=verify_payload,
            headers=headers,
        )
        print(f"Status: {verify_resp.status_code}")
        assert verify_resp.status_code == 200, f"Verification failed: {verify_resp.text}"
        assert verify_resp.json()["is_verified"] is True
        print("✓ Human verification approval PASSED")

        print("\n=================================================================")
        print("  ALL PRESCRIPTION TESTS PASSED END-TO-END! NO ERRORS.")
        print("=================================================================")

if __name__ == "__main__":
    asyncio.run(main())
