from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.tasks import router as tasks_router
from .routes.projects import router as projects_router

app = FastAPI(title="Task Planner", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(projects_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
