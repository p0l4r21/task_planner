import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routes.tasks import router as tasks_router
from .routes.projects import router as projects_router

app = FastAPI(title="Task Planner", version="1.0.0")

# Allow configurable origins for deployment behind a reverse proxy
_extra_origins = os.environ.get("CORS_ORIGINS", "").split(",")
_origins = [o.strip() for o in _extra_origins if o.strip()] or [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(projects_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}
