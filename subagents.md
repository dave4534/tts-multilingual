# Subagents

Guide for AI coding assistants (Cursor, Claude, etc.) on how to decompose work across agents or parallel tasks.

---

## When to use parallel agents

These task groups are independent and can be worked on simultaneously:

### Group A: Modal GPU Worker (Phase 1) + Voice Sourcing (Phase 2)
- The Modal TTS worker and voice clip sourcing have no code dependencies
- Voice clips are needed for testing the worker, but stub/dummy clips can be used until real ones are ready

### Group B: Backend API (Phase 3) + Frontend UI (Phase 4)
- Can be developed in parallel once the Modal worker API contract is defined
- Backend API and frontend communicate via REST — agree on endpoints first, then build independently
- Use mock responses on the frontend while the backend is in progress
- Note: the backend API runs on Modal (via `@modal.asgi_app()`), not a separate service

---

## API Contract (for parallel development)

Frontend and backend developers (or agents) should agree on these endpoints before building independently:

```
POST   /convert              → { job_id: string }
GET    /job/{job_id}/status  → { state: string, progress: number }
GET    /job/{job_id}/download → MP3 binary
GET    /voices               → [{ id, name, description, preview_url }]
GET    /health               → { status: "ok" }
```

---

## Recommended agent splits

| Agent | Scope | Dependencies |
|---|---|---|
| Agent 1 | Modal GPU worker (Phase 1) | None — start first |
| Agent 2 | Voice sourcing (Phase 2) | None — manual/research task |
| Agent 3 | Modal API endpoints (Phase 3) | Needs GPU worker function signature |
| Agent 4 | Frontend UI (Phase 4) | Needs API contract above |
| Agent 5 | Integration + deployment (Phase 5-6) | Needs all above complete |
