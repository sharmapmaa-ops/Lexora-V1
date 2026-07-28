from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.routes import admin, auth, payments, plans, processing, support, users
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(plans.router, prefix=settings.API_V1_PREFIX)
app.include_router(payments.router, prefix=settings.API_V1_PREFIX)
app.include_router(support.router, prefix=settings.API_V1_PREFIX)
app.include_router(processing.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)


@app.get("/api/health")
def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}


# ----------------------------------------------------------------------
# Serve the built React app directly - one web service instead of two.
#
# The old project ran everything from a single process; splitting the
# rebuild into a separate FastAPI service + nginx/React service (two
# Render services) turned out to be more deployment friction than it
# was worth for this project's size. FRONTEND_DIST_DIR (populated by the
# root Dockerfile - see repo root) holds the frontend's `vite build`
# output. If it isn't present (e.g. running the backend alone in local
# dev against `npm run dev` on a different port), this whole block is
# skipped gracefully - only the API routes above are served.
# ----------------------------------------------------------------------
_frontend_dist = Path(__file__).resolve().parent.parent / "static"
if _frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        # Anything under /api/* that reaches here is a genuine 404 (no
        # matching route above) - never fall back to index.html for
        # those, or API errors would silently become confusing HTML
        # responses instead of proper JSON 404s.
        if full_path.startswith("api/"):
            from fastapi import HTTPException, status
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")

        candidate = _frontend_dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        # React Router handles the actual routing client-side - every
        # other path (e.g. /login, /dashboard) serves the same index.html.
        return FileResponse(_frontend_dist / "index.html")
