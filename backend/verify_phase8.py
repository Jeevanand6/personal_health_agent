import sys
import os
from datetime import date, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.timeline_event import TimelineEvent
from app.services.timeline_service import timeline_service


def test_phase8():
    print("==================================================")
    print("STARTING PHASE 8 VERIFICATION: HEALTHCARE TIMELINE")
    print("==================================================")

    db = SessionLocal()
    try:
        # 1. Locate Demo User
        demo_user = db.query(User).filter(User.email == "demo@example.com").first()
        assert demo_user is not None, "Demo user demo@example.com should exist in database!"
        print(f"Found demo user: {demo_user.email} (ID: {demo_user.id})")

        # 2. Test timeline synchronization from verified records
        print("\n--- 1. Testing Timeline Synchronization ---")
        synced_count = timeline_service.sync_user_timeline(db, demo_user.id)
        print(f"Initial sync processed: {synced_count} new events added.")

        # Query all events from DB
        all_events = db.query(TimelineEvent).filter(TimelineEvent.user_id == demo_user.id).all()
        assert len(all_events) > 0, "Timeline events should have been created from verified documents!"
        print(f"Total verified timeline events in DB: {len(all_events)}")

        # Verify safety constraint: EVERY event must have a source document ID!
        for ev in all_events:
            assert ev.source_document_id is not None, f"Event {ev.id} is missing source_document_id!"
            assert ev.event_type in [
                "DOCUMENT", "DIAGNOSIS", "MEDICATION", "LAB_RESULT",
                "DIAGNOSTIC_REPORT", "DISCHARGE", "ENCOUNTER"
            ], f"Event {ev.id} has invalid event_type {ev.event_type}!"
            assert ev.title, f"Event {ev.id} is missing a title!"
            assert ev.event_date is not None, f"Event {ev.id} is missing event_date!"
        print("VERIFIED: Every timeline event is strictly grounded with a valid source_document_id and required fields.")

        # 3. Test Service Querying & Filters
        print("\n--- 2. Testing Service Querying, Grouping & Filters ---")
        timeline_res = timeline_service.get_timeline(db, demo_user.id, category="all", order="desc")
        assert timeline_res.stats.total_events == len(all_events)
        assert len(timeline_res.grouped_events) > 0, "Grouped events should not be empty!"
        print(f"Grouped into {len(timeline_res.grouped_events)} distinct date groups.")
        print(f"Events by type: {timeline_res.stats.by_type}")

        # Check chronological ordering
        for i in range(len(timeline_res.events) - 1):
            assert timeline_res.events[i].event_date >= timeline_res.events[i+1].event_date, "Events should be descending chronologically!"
        print("VERIFIED: Chronological sorting (desc) is strictly maintained.")

        # Test Category: Medications
        med_res = timeline_service.get_timeline(db, demo_user.id, category="medications")
        assert len(med_res.events) >= 2, "Expected at least 2 medication events"
        for ev in med_res.events:
            assert ev.event_type == "MEDICATION"
        print(f"Category 'medications' returned {len(med_res.events)} events.")

        # Test Category: Laboratory
        lab_res = timeline_service.get_timeline(db, demo_user.id, category="laboratory")
        assert len(lab_res.events) >= 15, "Expected 15 lab result events"
        for ev in lab_res.events:
            assert ev.event_type == "LAB_RESULT"
        print(f"Category 'laboratory' returned {len(lab_res.events)} events.")

        # Test Category: Diagnoses
        diag_res = timeline_service.get_timeline(db, demo_user.id, category="diagnoses")
        assert len(diag_res.events) >= 2, "Expected at least 2 diagnosis events"
        for ev in diag_res.events:
            assert ev.event_type == "DIAGNOSIS"
        print(f"Category 'diagnoses' returned {len(diag_res.events)} events.")

        # Test Date Range Filtering
        print("\n--- 3. Testing Date Range Filtering ---")
        d_start = date(2025, 1, 1)
        d_end = date(2025, 2, 28)
        range_res = timeline_service.get_timeline(
            db, demo_user.id, category="all", start_date=d_start, end_date=d_end
        )
        for ev in range_res.events:
            ev_d = ev.event_date.date()
            assert d_start <= ev_d <= d_end, f"Event date {ev_d} outside requested range!"
        print(f"Date range filter [{d_start} to {d_end}] returned {len(range_res.events)} events.")

        # 4. Test REST API Endpoints via TestClient
        print("\n--- 4. Testing REST API Endpoints ---")
        client = TestClient(app)

        # Login
        login_res = client.post(
            "/api/auth/login",
            json={"email": "demo@example.com", "password": "Password123!"},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # GET /api/timeline
        get_res = client.get("/api/timeline", headers=headers)
        assert get_res.status_code == 200, f"GET /api/timeline failed: {get_res.text}"
        data = get_res.json()
        assert "events" in data
        assert "grouped_events" in data
        assert "stats" in data
        assert data["stats"]["total_events"] > 0
        print(f"GET /api/timeline -> HTTP 200 OK ({data['stats']['total_events']} events returned)")

        # GET /api/timeline?category=medications
        get_meds = client.get("/api/timeline?category=medications", headers=headers)
        assert get_meds.status_code == 200
        assert len(get_meds.json()["events"]) >= 2
        print(f"GET /api/timeline?category=medications -> HTTP 200 OK")

        # GET /api/timeline?search=Metformin
        get_search = client.get("/api/timeline?search=Metformin", headers=headers)
        assert get_search.status_code == 200
        assert len(get_search.json()["events"]) >= 1
        print(f"GET /api/timeline?search=Metformin -> HTTP 200 OK ({len(get_search.json()['events'])} matches)")

        # POST /api/timeline/sync
        sync_res = client.post("/api/timeline/sync", headers=headers)
        assert sync_res.status_code == 200
        assert sync_res.json()["status"] == "synced"
        print(f"POST /api/timeline/sync -> HTTP 200 OK")

        print("\n==================================================")
        print("ALL PHASE 8 BACKEND TESTS PASSED SUCCESSFULLY!")
        print("==================================================")
    finally:
        db.close()


if __name__ == "__main__":
    test_phase8()
