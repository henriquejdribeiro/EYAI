# Scrum Agent — EY AI Challenge 2026

An AI-powered Scrum Master that turns a project brief into a complete sprint plan: user stories, acceptance criteria, tasks with hour estimates, sprint composition, and risks — all aligned to a real team roster and capacity.

Built for the [EY AI Challenge 2026 — Scrum Agent](https://github.com/EY-AI-Challenge/Scrum-Agent).

## What it does

| Capability | How |
| --- | --- |
| Ingest a project brief | Paste text or upload one of the EY challenge PDFs (`data/projects/Project*.pdf`). The backend extracts text with `pypdf`. |
| Parse a team roster | Upload a `.txt`/`.md` file with Name/Role/Skills/Capacity blocks, or use the default 6-person team. |
| Generate user stories | Claude (Anthropic) produces Connextra-format stories with Gherkin acceptance criteria, Fibonacci story points, and priority. |
| Plan sprints | Stories are distributed across N sprints respecting team capacity; higher priority lands in earlier sprints. |
| Assign tasks | Each story is broken into tasks with hour estimates and a suggested assignee chosen from the roster's skills. |
| Surface risks | The agent identifies project-specific risks, not generic boilerplate. |
| Run offline | If `ANTHROPIC_API_KEY` is absent, the backend falls back to a deterministic mock plan — the demo never breaks. |

## Architecture

```
┌──────────────────┐   POST /api/plan   ┌────────────────────────┐
│ React + Vite UI  │ ─────────────────▶ │ FastAPI backend        │
│  (port 5173)     │ ◀───────────────── │   • PDF text extract   │
│                  │     JSON plan      │   • Team parser        │
└──────────────────┘                    │   • Claude agent       │
                                        │   • Mock fallback      │
                                        └────────────────────────┘
                                                  │
                                                  ▼
                                        Anthropic Claude API
                                        (claude-sonnet-4-6)
```

## Quick start (Windows / PowerShell)

```powershell
# from the project root
.\scripts\dev.ps1
```

This opens two PowerShell windows: one running the FastAPI backend on `:8008`, one running the Vite dev server on `:5173`. Open <http://127.0.0.1:5173>.

### Manual start

**Backend**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then edit and add ANTHROPIC_API_KEY (optional)
uvicorn app.main:app --reload --port 8008
```

**Frontend**
```powershell
cd frontend
npm install
npm run dev
```

## Project layout

```
scrum-agent/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI routes
│   │   ├── agent.py           Claude + mock planner
│   │   ├── models.py          Pydantic schemas
│   │   ├── prompts.py         System + planning prompts
│   │   ├── pdf_loader.py      pypdf extraction
│   │   └── team_loader.py     Roster parser
│   ├── tests/                 pytest suite
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx            Main shell
│   │   ├── components/        ProjectInput, TeamPanel, SprintBoard, StoryCard
│   │   ├── lib/api.ts         REST client
│   │   └── styles.css         EY-themed styling
│   ├── package.json
│   └── vite.config.ts         Proxies /api → :8008
├── data/
│   ├── projects/              EY sample PDFs (Project1-3.pdf)
│   └── team_members.txt       EY sample team
├── scripts/dev.ps1
├── README.md
└── LICENSE
```

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET`  | `/api/health` | Returns LLM mode (`claude` or `mock`) and model name. |
| `GET`  | `/api/team` | Returns the team roster from `data/team_members.txt` (falls back to default). |
| `POST` | `/api/team/parse` | Multipart upload: parses a custom team file. |
| `POST` | `/api/projects/extract` | Multipart upload: extracts text from a PDF. |
| `POST` | `/api/plan` | Body: `{project_text, project_name, sprint_count, sprint_length_days, team}`. Returns a full `ProjectPlan`. |

Interactive docs at <http://127.0.0.1:8008/docs>.

## Configuration

`backend/.env`:

| Variable | Default | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | _(unset)_ | Without it, mock mode is used. |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6` | Any Claude model id. |
| `SCRUM_AGENT_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated. |

## Testing

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q
```

The default test suite exercises the deterministic mock planner so it runs without an API key.

## Mapping to the challenge brief

| Challenge requirement | Implementation |
| --- | --- |
| Generate user stories & tasks from project descriptions | `POST /api/plan` |
| Create, plan, and prioritize sprints automatically | Distribution in `agent._build_sprints` + priority sort |
| Dynamic editing of sprints/tasks | Frontend state model holds a fully editable `ProjectPlan` (story cards are details-collapsed and ready to wire up edit handlers) |
| Functional frontend interface | React + Vite at `:5173` with EY-themed UI |
| Align tasks with team capabilities | `_resolve_assignee` matches skills/names from the roster |
| Python-primary stack | Backend is 100% Python; LLM logic and parsing live there |
| Well-documented, reproducible code | This README + `.env.example` + `dev.ps1` |

## License

MIT. See `LICENSE`.
