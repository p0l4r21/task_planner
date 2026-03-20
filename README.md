# Task Planner

A local-first task planner for managing operational work — capture, prioritize, schedule, and complete tasks from a single command center.

## Architecture

```
task_planner/
├── backend/                  # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point + CORS
│   │   ├── models/task.py    # Pydantic models & enums
│   │   ├── routes/tasks.py   # REST API endpoints
│   │   └── services/
│   │       └── task_service.py  # CSV persistence & business logic
│   ├── data/                 # CSV data files (auto-created)
│   │   ├── tasks_active.csv
│   │   └── tasks_completed.csv
│   ├── seed.py               # Sample data seeder
│   └── requirements.txt
├── frontend/                 # React + TypeScript UI (Vite)
│   ├── src/
│   │   ├── api/              # HTTP client
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Data hooks
│   │   ├── pages/            # Route pages
│   │   └── types/            # TypeScript types
│   └── package.json
└── README.md
```

### Design decisions

- **CSV persistence**: Two files — `tasks_active.csv` for live work, `tasks_completed.csv` for history. Thread-safe file I/O with a lock. Files auto-create on first access.
- **UUID IDs**: Every task gets a UUID to prevent collisions.
- **Bucket ↔ Status sync**: Moving a task between buckets automatically syncs the status field.
- **Vite proxy**: Frontend dev server proxies `/api` to the backend, so no CORS issues in development.

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Seed sample data (optional, run once)
python seed.py

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## API Endpoints

| Method  | Path                          | Description             |
|---------|-------------------------------|-------------------------|
| POST    | /api/tasks                    | Create task             |
| GET     | /api/tasks                    | List active tasks       |
| GET     | /api/tasks/summary            | Dashboard metrics       |
| GET     | /api/tasks/completed          | List completed tasks    |
| GET     | /api/tasks/{id}               | Get single task         |
| PUT     | /api/tasks/{id}               | Update task             |
| PATCH   | /api/tasks/{id}/move          | Move task to bucket     |
| PATCH   | /api/tasks/{id}/complete      | Mark task complete      |
| PATCH   | /api/tasks/{id}/restore       | Restore completed task  |
| DELETE  | /api/tasks/{id}               | Delete task             |

### Filtering (GET /api/tasks)

Query params: `bucket`, `priority`, `tag`, `project`, `due_date`, `search`, `sort_by`, `sort_dir`

## Pages

1. **Dashboard** — Summary cards, quick-add, kanban board of all buckets
2. **Active Tasks** — Kanban or table view with filters and sorting
3. **Completed Tasks** — Searchable history table with restore capability
4. **Settings** — App info and roadmap

## Next Steps

- [ ] Drag-and-drop between kanban columns
- [ ] SQLite migration (swap CSV service for DB layer)
- [ ] Recurring tasks with cron scheduling
- [ ] Weekly report generation (PDF/email)
- [ ] Planner / Microsoft Graph API sync
- [ ] Task dependencies and blockers graph
- [ ] Per-task notes/activity log
- [ ] Work effort estimates and time tracking
- [ ] Email ingestion to create tasks
- [ ] Dark/light theme toggle
