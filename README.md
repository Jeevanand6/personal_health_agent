# AI-Powered Personal Health Copilot (Phase 1)

A production-style hackathon prototype for intelligent medical document ingestion, plain-language clinical explanations, abnormal lab value detection, and longitudinal health tracking.

---

## Phase 1 Architecture Overview

- **Frontend:** Next.js 14 App Router (TypeScript, Tailwind CSS, Recharts) on port `3000`
- **Backend:** FastAPI (Python 3.11, Pydantic v2, SQLAlchemy 2.0, Alembic) on port `8000`
- **Database:** PostgreSQL 16 Alpine on port `5432`
- **Containerization:** Multi-container Docker Compose with health-checked service dependencies

---

## Quick Start (Run with Docker Compose)

### 1. Prerequisites
- Docker & Docker Compose installed

### 2. Launch Services
From the repository root:
```bash
docker compose up --build
```

### 3. Verify Endpoints
- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Dashboard Shell:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **FastAPI OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check Endpoint:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

Expected output from `/api/health`:
```json
{
  "status": "healthy",
  "database": "connected"
}
```
