# Lexora AI Solutions — Platform Rebuild

A ground-up rebuild of the Lexora platform on a professional stack:
**FastAPI + SQLAlchemy + PostgreSQL** backend, **React + TypeScript + Vite +
Tailwind** frontend.

This replaces the previous prototype (a single Python stdlib `http.server`
process + a single ~600KB `app.js`) with a properly structured, typed,
tested, migration-managed codebase. Every design decision below exists
because of a specific problem in the old project — see the "Fixed from
the old project" notes throughout the code for the specific reasoning.

## What's genuinely built and verified

Everything listed here was actually run against a real PostgreSQL
instance and a real running server during development — not just
written and assumed to work.

- **Database**: 10 tables (users, plans, plan_service_pricing,
  transactions, notifications, support_tickets, support_ticket_messages,
  processing_jobs, company_profile, email_verification_tokens), real
  Alembic migration generated and applied.
- **Auth**: register / login / refresh / me, JWT access + refresh
  tokens, bcrypt password hashing.
- **Plans & billing**: 3 plans seeded (Free/Standard/Professional) with
  per-service pricing (translation/OCR/data extraction/BAI2/lease
  abstraction) in an extensible child table — adding a new billable
  service is a data change, not a migration. Plan switching correctly
  charges only on upgrade, never on downgrade (this was a real bug in
  the old project, fixed here).
- **Wallet**: balance, transaction history, Razorpay order
  create/verify, PDF invoice generation.
- **Support tickets**: threaded ticket + messages.
- **BAI2 pipeline** (fully working end-to-end, no external API needed):
  a real BAI2 bank statement parser
  (`app/services/processing/bai2_service.py`, 6 unit tests), wired
  through upload -> job creation -> billing -> result storage ->
  download. Verified with real requests against real Postgres.
- **Translation pipeline** (fully wired, LLM calls untested against a
  real provider - no API key available in this environment): a real
  `LlmClient` abstraction (`app/core/llm.py`, supports OpenRouter or
  OpenAI) and `TranslationService`
  (`app/services/processing/translation_service.py`). The service
  takes its `LlmClient` as a constructor argument specifically so
  `tests/test_translation_service.py` can substitute a fake client and
  verify billing/storage/job-status logic for real (3 tests, all
  passing) without needing credentials. Verified live: uploading
  without `OPENROUTER_API_KEY` set correctly returns a clear error and
  charges nothing — set the key in `.env` and it calls the real API.
- **Data extraction pipeline** (fully wired, same LLM-caller pattern as
  Translation): `DataExtractionService`
  (`app/services/processing/data_extraction_service.py`) takes a list
  of field names, asks the LLM for a JSON object mapping each to its
  value, and stores that structured result. 5 tests, all passing with a
  fake LLM client — including a malformed-JSON response correctly
  failing the job (and not charging) rather than crashing, and a
  markdown-code-fenced response being parsed correctly despite the
  system prompt asking the model not to do that (models don't always
  listen).
- **OCR pipeline** (fully wired, including the PDF page-rendering
  infrastructure OCR and lease abstraction both need):
  `app/core/pdf_utils.py` renders each PDF page to a PNG with PyMuPDF
  (5 tests, all passing — including a caught-and-fixed real bug where
  the "too many pages" error message read `doc.page_count` after the
  document was already closed). `LlmClient` gained a
  `complete_with_image` method for vision calls. `OcrService` sends one
  vision call per rendered page and bills per page (not a flat rate —
  verified a 3-page document bills 3x the per-page rate, with exactly 3
  vision calls made). 5 more tests, all passing with a fake vision
  client and a real PDF generated with reportlab.
- **Lease abstraction pipeline** (fully wired, two-stage): reuses
  OCR's page-rendering and vision-calling infrastructure for a
  per-page OCR pass, then a second `complete()` call structures the
  combined text into lease-specific fields (parties, term, rent,
  deposit, renewal options, escalations). Billed as a flat per-document
  rate rather than OCR's per-page rate — verified with a 4-page test
  document specifically to prove it bills once, not 4x, while still
  making 4 OCR calls (one per page) plus exactly 1 structuring call.
  6 tests, all passing, including both failure modes (OCR stage fails
  vs. extraction stage fails) each correctly charging nothing.
- **Admin Panel**: one generic CRUD API (list/create/update/delete)
  driven by a model registry — works for every registered table without
  per-table code. Verified: sensitive fields (password hash, API key)
  are excluded automatically; non-admin users get a real 403.
- **Frontend**: full page set (login, register, dashboard, services,
  all 5 pipeline upload pages, plans, payments, support, admin),
  premium design system, `tsc -b` clean, production `vite build`
  succeeds.

**All 5 services from the old project (BAI2, Translation, Data
Extraction, OCR, Lease Abstraction) are now wired end-to-end** on the
new architecture, with 30 backend tests covering billing correctness,
storage, and failure handling for every one of them.

- **Admin Overview dashboard**: platform-wide stats (total users, revenue,
  open tickets, plan distribution, jobs-by-service) from one aggregate
  endpoint (`GET /admin/overview`), rendered with charts on the frontend.
  Verified against real seeded data.
- **User Profile**: view/edit name, mobile, gender, birthdate; upload a
  profile photo (stored via the same storage abstraction as processing
  jobs, served back through a public `/users/photo/{user_id}` endpoint
  since `<img>` tags can't send Authorization headers). Verified
  end-to-end: uploaded a real JPEG, fetched it back, correct bytes.
- **API Documentation page**: plan-gated exactly like the old project
  (Standard/Professional only; Free plan users see an upgrade prompt
  instead) — generate/copy/revoke your API key, plus a link to the
  live Swagger reference at `/api/docs` (auto-generated from the actual
  route type hints, so it's never out of sync with the real API).
- **Company Settings** (admin-only): edit the company profile shown on
  invoices, backed by dedicated `GET`/`PATCH /admin/company` endpoints.
- **Free Services**: genuine, working client-side PDF tools (Merge,
  Split/extract pages, Rotate) using `pdf-lib` — files never leave the
  browser, no backend cost, matching the old project's "free tools"
  concept. Verified the merge/split logic directly with `pdf-lib`
  before wiring up the UI (3-page merge produced exactly 3 pages;
  single-page extraction produced exactly 1).

## What's next (not deferred pipelines anymore — infra/scale work)

All five processing pipelines exist and are tested. What's left is
genuinely operational, not "missing features":

- **Real LLM credentials**: every AI-backed pipeline (translation, data
  extraction, OCR, lease abstraction) has been verified against fake
  LLM clients, proving the billing/storage/job-tracking logic is
  correct - but none have been called against a real OpenRouter/OpenAI
  endpoint, since this environment has no API key. Set
  `OPENROUTER_API_KEY` (or `LLM_PROVIDER=openai` + `OPENAI_API_KEY`) in
  `.env` and every pipeline calls the real API with no code changes -
  worth doing a real end-to-end test with actual documents before
  going live.
- **Background processing**: OCR and lease abstraction now make
  multiple sequential LLM calls per document (one per page, plus one
  more for lease abstraction's structuring stage) - for anything beyond
  a handful of pages this will want to move off the request/response
  cycle into a background task (FastAPI's `BackgroundTasks`, or a
  proper queue like Celery/RQ for real volume), with the job staying
  `queued`/`processing` until the background work finishes.
- **S3 storage**: `STORAGE_BACKEND=s3` is a config value away from
  local disk, but the `S3Storage` class implementing the same
  `Storage` interface as `LocalStorage` (`app/core/storage.py`) still
  needs writing - straightforward given `boto3` is already a
  dependency.
- **Frontend polish**: the upload pages are functional but plain -
  progress indicators for multi-page OCR/lease-abstraction jobs,
  richer result viewers (e.g. rendering the PDF alongside its
  extracted fields), and the translation/data-extraction pages
  currently only accept `.txt` — accepting PDFs and extracting text
  first (or routing them through OCR) is a natural next step once real
  LLM credentials make that worth testing properly.

## Architecture

```
backend/
  app/
    core/         # config, database engine, security (JWT + hashing) - nothing
                   # else in the app should touch os.environ, create a DB
                   # session, or hash a password directly
    models/        # SQLAlchemy ORM models - one file per domain concept
    schemas/       # Pydantic request/response shapes - controls exactly
                   # what a client can send in and see out
    services/      # business logic (auth_service, billing_service, ...) -
                   # routes stay thin, logic here is unit-testable without FastAPI
    api/v1/routes/ # FastAPI routers - parse request, call a service, shape response
    api/v1/admin_registry.py  # declares which models are admin-manageable
    seed.py        # idempotent seed script (plans + first admin user)
  alembic/         # migrations - `alembic revision --autogenerate` / `alembic upgrade head`

frontend/
  src/
    components/ui/      # Button/Card/Badge/StatCard primitives
    components/layout/  # AppShell (sidebar+topbar), ProtectedRoute
    features/<domain>/  # one folder per page/feature area
    lib/                # api client, auth store (zustand)
```

## Local development

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, SECRET_KEY at minimum
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```
API docs at `http://localhost:8000/api/docs` (Swagger UI, auto-generated
from the route type hints — always current, unlike hand-maintained
docs).

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Opens at `http://localhost:5173`; API calls are proxied to
`localhost:8000` in dev (see `vite.config.ts`).

### Everything together
```bash
docker compose up --build
```
Starts Postgres, runs migrations + seed, starts the API, and serves the
built frontend via nginx.

## Deploying to AWS

- **Database**: RDS for PostgreSQL. Point `DATABASE_URL` at the RDS
  endpoint; nothing else changes.
- **Backend**: the `backend/Dockerfile` image runs on App Runner,
  Lightsail Containers, ECS Fargate, or a plain EC2 + Docker — pick
  based on how much ops overhead you want. Run
  `alembic upgrade head && python -m app.seed` once per deploy (the
  Docker Compose `command:` shows the pattern) rather than baking it
  into the image's own startup, so scaling to multiple instances never
  races migrations.
- **Frontend**: the built `dist/` is static — S3 + CloudFront, or the
  same container approach via `frontend/Dockerfile`, both work fine.
- **File storage**: `STORAGE_BACKEND=s3` in `.env` once you're ready to
  point uploads at S3 instead of local disk (the storage abstraction
  point is `app/core/config.py`'s `STORAGE_*` settings — the actual S3
  client wiring is one of the next things to add alongside the
  processing pipelines).

## First login

The seed script creates `admin@lexoraaisolutions.com` /
`ChangeMe123!` with the Admin role. **Change this password immediately**
after your first deploy — there's no forced-reset-on-first-login flow
yet, so this is a manual step.
