from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import time

# Load environment variables from .env before anything else
load_dotenv()

# Import routes
from Routes.auth import router as auth_router
from Routes.repository import router as repository_router
from Routes.upload import router as upload_router
from Routes.scan import router as scan_router
from Utils.logger import get_logger

logger = get_logger("main")

app = FastAPI(
    title="SecureTrail API",
    description="AI-Powered DevSecOps Security Analysis Platform",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

# ── Request timing middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    elapsed = round((time.monotonic() - start) * 1000, 1)
    response.headers["X-Response-Time"] = f"{elapsed}ms"
    return response

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router,       prefix="/api/auth",       tags=["Authentication"])
app.include_router(repository_router, prefix="/api/repository", tags=["Repository"])
app.include_router(upload_router,     prefix="/api/upload",     tags=["Upload"])
app.include_router(scan_router,       prefix="/api/scan",       tags=["Scan"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "SecureTrail API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/api/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    from Jobs.job_manager import job_manager
    from Database.connection import check_db_connection
    jobs = job_manager.all_jobs()
    db_ok = await check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "ok" if db_ok else "unavailable",
        "active_jobs": sum(1 for j in jobs.values() if j["status"] == "running"),
        "total_jobs": len(jobs),
    }


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("SecureTrail API v2.0.0 starting up")

    # Initialise PostgreSQL connection pool
    from Database.connection import init_db
    await init_db()
    logger.info("Database ready")

    # Ensure temp directory exists
    from Utils.temp_manager import ensure_temp_root
    ensure_temp_root()
    logger.info("Temp directory ready")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("SecureTrail API shutting down")
    from Database.connection import close_db
    await close_db()


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        reload_dirs=["./"] if debug else None,   # watch only Backend/
        reload_excludes=["uploads/*", "__pycache__/*", "alembic/*"] if debug else None,
    )
