from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router
from api.procedural.routes import router as procedural_router

app = FastAPI(title="WarMatrix Backend Engine",root_path="/backend")

# Add CORS so the frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    # Use allow_origin_regex for your pattern
    allow_origin_regex=r"https://.*\.vercel\.app",
    # You can still use allow_origins for exact matches like localhost
    allow_origins=["http://localhost"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the simulation routes
app.include_router(api_router, prefix="/api")
app.include_router(procedural_router, prefix="/api/procedural")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "WarMatrix Engine Backend"}
