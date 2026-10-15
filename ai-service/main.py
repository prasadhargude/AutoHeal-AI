from fastapi import FastAPI

app = FastAPI(
    title="AutoHeal AI Service",
    description="AI-based fault diagnosis and recovery service",
    version="1.0.0",
)

@app.get("/health")
def health():
    return {
        "service": "ai-service",
        "status": "UP",
    }
