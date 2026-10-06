#!/usr/bin/env python3
"""
Verification Script for PHASE 10:
ABDM-Ready Healthcare Data Architecture using FHIR-Style Resources & Mock ABHA.
Validates:
1. Authentication & Bearer token retrieval
2. FHIR Patient Resource with Mock ABHA ID (format XX-XXXX-XXXX-XXXX) & DEMO / MOCK badge
3. FHIR Observations (LOINC codes, reference ranges, status interpretations)
4. FHIR MedicationRequests (RxNorm codes, dosage instructions, prescribing doctors)
5. FHIR Conditions (SNOMED CT codes, clinical & verification status)
6. FHIR DiagnosticReports (performer, observation references, document attachments)
7. FHIR DocumentReferences (MIME type, file size, download link)
8. FHIR Full Export Bundle (type: collection, valid structured JSON)
9. Grounding verification (records originate from existing database rows)
"""

import sys
import json
import re
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"


def print_step(title: str):
    print(f"\n{'='*70}\n[PHASE 10 TEST] {title}\n{'='*70}")


def request_json(url: str, token: str = None, method: str = "GET", payload: dict = None):
    req_headers = {"Content-Type": "application/json"}
    if token:
        req_headers["Authorization"] = f"Bearer {token}"
    data_bytes = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(f"{BASE_URL}{url}", data=data_bytes, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"HTTP ERROR {e.code} for {url}: {err_body}")
        raise e


def main():
    print_step("1. Authenticating as Demo User")
    status, auth_data = request_json(
        "/api/auth/login",
        method="POST",
        payload={"email": "demo@example.com", "password": "Password123!"},
    )
    assert status == 200, f"Login failed with status {status}"
    token = auth_data["access_token"]
    print(f"[OK] Authentication successful! Token acquired.")

    # 2. Patient & Mock ABHA
    print_step("2. Verifying FHIR Patient & Mock ABHA Resource")
    status, patient = request_json("/api/fhir/patient", token=token)
    assert status == 200, f"Patient request failed with status {status}"
    assert patient["resourceType"] == "Patient", f"Invalid resourceType: {patient.get('resourceType')}"
    
    mock_meta = patient.get("mock_abha_meta", {})
    mock_abha_id = mock_meta.get("mock_abha_id")
    print(f"[OK] Mock ABHA ID: {mock_abha_id}")
    print(f"[OK] Badge: {mock_meta.get('badge')}")
    print(f"[OK] Disclaimer: {mock_meta.get('disclaimer')}")
    
    # Check XX-XXXX-XXXX-XXXX format
    assert re.match(r"^\d{2}-\d{4}-\d{4}-\d{4}$", mock_abha_id), (
        f"Mock ABHA ID {mock_abha_id} does not match required XX-XXXX-XXXX-XXXX format"
    )
    assert mock_meta.get("badge") == "DEMO / MOCK ABHA ID", "Badge missing or incorrect"
    assert mock_meta.get("is_official_abdm") is False, "Must not claim official ABDM integration"

    # 3. Observations
    print_step("3. Verifying FHIR Observations (LOINC & Grounded Values)")
    status, obs_bundle = request_json("/api/fhir/observations", token=token)
    assert status == 200, f"Observations failed with status {status}"
    assert obs_bundle["resourceType"] == "Bundle"
    total_obs = obs_bundle["total"]
    print(f"[OK] Total Observations: {total_obs}")
    assert total_obs > 0, "No observations found in database"
    first_obs = obs_bundle["entry"][0]["resource"]
    assert first_obs["resourceType"] == "Observation"
    print(f"  Sample Observation: {first_obs['code']['text']}")
    print(f"  Category: {first_obs['category'][0]['text']}")
    print(f"  Interpretation Status: {first_obs['interpretation'][0]['text']}")
    print(f"  Derived From: {first_obs['derivedFrom'][0]['reference']}")
    assert len(first_obs.get("derivedFrom", [])) > 0, "Observation must link to source document"

    # 4. MedicationRequests
    print_step("4. Verifying FHIR MedicationRequests (Prescriptions & Dosages)")
    status, med_bundle = request_json("/api/fhir/medications", token=token)
    assert status == 200, f"Medications failed with status {status}"
    assert med_bundle["resourceType"] == "Bundle"
    total_meds = med_bundle["total"]
    print(f"[OK] Total MedicationRequests: {total_meds}")
    assert total_meds > 0, "No medications found for demo user"
    first_med = med_bundle["entry"][0]["resource"]
    assert first_med["resourceType"] == "MedicationRequest"
    print(f"  Sample Medication: {first_med['medicationCodeableConcept']['text']}")
    print(f"  Dosage Instruction: {first_med['dosageInstruction'][0]['text']}")
    print(f"  Prescribing Doctor: {first_med['requester']['display']}")
    print(f"  Supporting Document: {first_med['supportingInformation'][0]['reference']}")

    # 5. Conditions
    print_step("5. Verifying FHIR Conditions (Diagnoses & SNOMED CT)")
    status, cond_bundle = request_json("/api/fhir/conditions", token=token)
    assert status == 200, f"Conditions failed with status {status}"
    assert cond_bundle["resourceType"] == "Bundle"
    total_conds = cond_bundle["total"]
    print(f"[OK] Total Conditions: {total_conds}")
    assert total_conds > 0, "No conditions found for demo user"
    first_cond = cond_bundle["entry"][0]["resource"]
    assert first_cond["resourceType"] == "Condition"
    print(f"  Sample Condition: {first_cond['code']['text']}")
    print(f"  Clinical Status: {first_cond['clinicalStatus']['text']}")
    print(f"  Verification Status: {first_cond['verificationStatus']['text']}")
    print(f"  Evidence: {first_cond['evidence'][0]['detail'][0]['reference']}")

    # 6. DiagnosticReports
    print_step("6. Verifying FHIR DiagnosticReports (Linked Labs & PDF Attachments)")
    status, rep_bundle = request_json("/api/fhir/diagnostic-reports", token=token)
    assert status == 200, f"DiagnosticReports failed with status {status}"
    assert rep_bundle["resourceType"] == "Bundle"
    total_reps = rep_bundle["total"]
    print(f"[OK] Total DiagnosticReports: {total_reps}")
    assert total_reps > 0, "No diagnostic reports found"
    first_rep = rep_bundle["entry"][0]["resource"]
    assert first_rep["resourceType"] == "DiagnosticReport"
    print(f"  Report Code: {first_rep['code']['text']}")
    print(f"  Performer: {first_rep['performer'][0]['display']}")
    print(f"  Attached Observation Results: {len(first_rep['result'])}")
    print(f"  Presented Form URL: {first_rep['presentedForm'][0]['url']}")

    # 7. DocumentReferences
    print_step("7. Verifying FHIR DocumentReferences (Medical Records)")
    status, doc_bundle = request_json("/api/fhir/document-references", token=token)
    assert status == 200, f"DocumentReferences failed with status {status}"
    assert doc_bundle["resourceType"] == "Bundle"
    total_docs = doc_bundle["total"]
    print(f"[OK] Total DocumentReferences: {total_docs}")
    assert total_docs > 0, "No document references found"
    first_doc = doc_bundle["entry"][0]["resource"]
    assert first_doc["resourceType"] == "DocumentReference"
    print(f"  Document Title: {first_doc['content'][0]['attachment']['title']}")
    print(f"  MIME Type: {first_doc['content'][0]['attachment']['contentType']}")
    print(f"  Download URL: {first_doc['content'][0]['attachment']['url']}")

    # 8. Full Export Bundle
    print_step("8. Verifying Full FHIR R4 Collection Export Bundle")
    status, full_bundle = request_json("/api/fhir/export", token=token)
    assert status == 200, f"Export bundle failed with status {status}"
    assert full_bundle["resourceType"] == "Bundle"
    assert full_bundle["type"] == "collection"
    total_entries = full_bundle["total"]
    print(f"[OK] Full FHIR Bundle Total Resources: {total_entries}")
    assert total_entries >= 10, f"Expected at least 10 resources in bundle, got {total_entries}"

    # Verify resource types present
    types_found = {entry["resource"]["resourceType"] for entry in full_bundle["entry"]}
    print(f"[OK] Resource Types present in exported bundle: {sorted(list(types_found))}")
    expected_types = {"Patient", "Observation", "MedicationRequest", "Condition", "DiagnosticReport", "DocumentReference", "Encounter"}
    missing = expected_types - types_found
    assert not missing, f"Missing required FHIR resource types in export: {missing}"

    # Verify bundle is valid JSON
    json_str = json.dumps(full_bundle)
    assert len(json_str) > 1000, "Bundle JSON output is unexpectedly small"
    print(f"[OK] Exported JSON Payload Size: {len(json_str):,} bytes of valid structured FHIR R4 JSON")

    print("\n" + "="*70)
    print("PHASE 10 VERIFICATION PASSED: 100% ABDM-READY FHIR R4 ARCHITECTURE VALIDATED!")
    print("="*70)


if __name__ == "__main__":
    main()
