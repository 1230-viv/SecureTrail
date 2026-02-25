from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Import routes
from Routes.auth import router as auth_router
from Routes.repository import router as repository_router
from Routes.upload import router as upload_router

app = FastAPI(
    title="SecureTrail API",
    description="AI Security Mentor - Backend API",
    version="1.0.0"
)

# CORS Configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(repository_router, prefix="/api/repository", tags=["Repository"])
app.include_router(upload_router, prefix="/api/upload", tags=["Upload"])

@app.get("/")
async def root():
    return {
        "message": "Welcome to SecureTrail API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
