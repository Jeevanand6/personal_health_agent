import requests
import json
import sys

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=== TESTING HEALTH COPILOT END-TO-END VIA API ===")
    
    # 1. Login to get access token
    login_resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": "demo@example.com", "password": "Password123!"}
    )
    if login_resp.status_code != 200:
        print(f"FAILED LOGIN: {login_resp.status_code} {login_resp.text}")
        sys.exit(1)
        
    token = login_resp.json()["access_token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    print("Login successful! Acquired JWT bearer token.")

    # 5 test questions
    questions = [
        "Who is my doctor?",
        "What medicines did my doctor prescribe?",
        "What is my HbA1c?",
        "Which values are abnormal?",
        "Explain my prescription."
    ]

    results = {}
    for idx, q in enumerate(questions, 1):
        print(f"\n[{idx}/5] Testing Question: \"{q}\"")
        payload = {
            "message": q,
            "language": "en"
        }
        res = requests.post(f"{BASE_URL}/copilot/chat", headers=headers, json=payload)
        if res.status_code != 200:
            print(f"ERROR: {res.status_code} {res.text}")
            results[q] = {"error": res.text}
            continue

        data = res.json()
        answer = data.get("answer", "")
        sources = data.get("sources", [])
        source_types = [s.get("source_type") for s in sources]
        source_names = [s.get("document_name") for s in sources]
        
        print("ANSWER:")
        print(answer)
        print("SOURCES:", source_names, "| TYPES:", source_types)

        # Check for banned markers
        if "<<<UNTRUSTED" in answer:
            print("FAILED: Marker <<<UNTRUSTED found in answer!")
            sys.exit(1)

        results[q] = {
            "answer": answer,
            "sources": source_names,
            "source_types": source_types
        }

    print("\n=== SUMMARY VERIFICATION ===")
    # 1. Who is my doctor? -> Must contain doctor name, must not dump lab tests or meds
    q1 = results["Who is my doctor?"]["answer"]
    assert "Dr." in q1, "Question 1 should return doctor name"
    assert "HbA1c" not in q1 and "Glucose" not in q1, "Question 1 must not contain lab results"
    print("PASS: Question 1 correctly returns doctor information without lab/med dumping.")

    # 2. What medicines did my doctor prescribe? -> Must contain prescription/meds, MUST NOT contain lab tests
    q2 = results["What medicines did my doctor prescribe?"]["answer"]
    assert ("Metformin" in q2 or "Atorvastatin" in q2), "Question 2 must return prescribed medication"
    assert "HbA1c" not in q2 and "Glucose" not in q2 and "Creatinine" not in q2, "Question 2 MUST NOT return lab observations!"
    print("PASS: Question 2 correctly returns prescribed medications and NO lab report.")

    # 3. What is my HbA1c? -> Must contain HbA1c value, must NOT contain medication list
    q3 = results["What is my HbA1c?"]["answer"]
    assert "HbA1c" in q3 or "7.4" in q3, "Question 3 must return HbA1c value"
    assert "Metformin" not in q3 and "Atorvastatin" not in q3, "Question 3 must not return medication list"
    print("PASS: Question 3 correctly returns HbA1c without medication dumping.")

    # 4. Which values are abnormal? -> Must contain abnormal observations only
    q4 = results["Which values are abnormal?"]["answer"]
    assert ("Total Cholesterol" in q4 or "Fasting Blood Sugar" in q4 or "HbA1c" in q4), "Question 4 must return abnormal tests"
    print("PASS: Question 4 correctly returns abnormal laboratory findings.")

    # 5. Explain my prescription -> Must explain prescription, must NOT contain lab observations
    q5 = results["Explain my prescription."]["answer"]
    assert ("Metformin" in q5 or "Prescription" in q5 or "Dr." in q5 or "prescribed" in q5), "Question 5 should explain prescription"
    assert "Creatinine" not in q5, "Question 5 must not dump lab observations"
    print("PASS: Question 5 correctly returns prescription explanation without lab dumping.")

    print("\nALL 5 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
