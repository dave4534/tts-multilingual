# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of Truth

- **Dev rules:** `.cursorrules` (canonical — read this first)
- **Product spec:** `docs/superpowers/specs/2026-03-12-tts-web-app-prd.md`
- **Build checklist:** `TASKS.md` (mark `[x]` when done, log to `CHANGELOG.md`)
- **Library docs & pitfalls:** `skills.md`
- **Parallel agent guide:** `subagents.md`

For dev rules, architecture, and MVP boundaries, read `.cursorrules`.

## Commands

```bash
# Frontend
cd frontend && npm install && npm run dev    # local dev server
cd frontend && npm run build                 # production build

# Modal (backend + GPU) — always run from project root, not inside modal_app/
modal serve modal_app/main.py               # local dev with hot reload
modal deploy modal_app/main.py              # deploy to production
```
