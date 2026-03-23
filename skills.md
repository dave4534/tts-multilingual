# Skills & Domain Knowledge

Reference for AI coding assistants working on this project.

---

## Key Libraries

### Chatterbox Multilingual (TTS Engine)
- **Docs:** https://github.com/resemble-ai/chatterbox
- **Modal example:** https://modal.com/docs/examples/chatterbox_tts
- **Model:** 0.5B parameters, MIT licensed
- **Voice cloning:** Zero-shot from 6-second reference audio clip
- **Languages:** 23 including English and Hebrew
- **Chunk limit:** ~300 characters per call — must chunk and stitch longer text
- **Long text handling:** See https://github.com/devnen/Chatterbox-TTS-Server for chunking patterns

### Modal (Serverless Backend + GPU)
- **Docs:** https://modal.com/docs
- **Pricing:** Per-second billing, $30/mo free tier, A10G ~$1.10/hr
- **Key patterns:**
  - `@modal.asgi_app()` — serve a full FastAPI app on Modal (this is our backend)
  - `@modal.function()` — define CPU or GPU functions
  - `.map()` — parallel execution across multiple inputs
  - `modal.Image` — define container image with dependencies (ffmpeg, pydub, PyMuPDF, etc.)
- **Cold starts:** 1-4 seconds typical
- **Important:** Modal hosts BOTH the API and GPU workers. There is no separate backend service.

### FastAPI (API Framework)
- **Docs:** https://fastapi.tiangolo.com
- **Key patterns:** async endpoints, `UploadFile` for file handling, background tasks
- **Runs on:** Modal via `@modal.asgi_app()` (not a separate server)

### PyMuPDF (PDF Parsing)
- **Docs:** https://pymupdf.readthedocs.io
- **Import as:** `import fitz`
- **Why not PyPDF2:** Better handling of complex layouts, multi-column, tables

### Tailwind CSS + Shadcn UI (Frontend Styling)
- **Tailwind:** https://tailwindcss.com — utility-first CSS
- **Shadcn:** https://ui.shadcn.com — accessible, copy-paste components built on Radix UI + Tailwind
- **Note:** Shadcn requires Tailwind. Use Shadcn for buttons, cards, progress bars, inputs; use Tailwind utilities for layout and custom styling.
- **Init:** Run `npx shadcn@latest init` in the frontend directory after Vite + Tailwind are set up.

### pydub + ffmpeg (Audio Stitching)
- **Docs:** https://github.com/jiaaro/pydub
- **Runs on:** Modal GPU functions (ample RAM available)
- **ffmpeg:** Must be installed in the Modal image

---

## Architecture Awareness

- **Modal:** Hosts everything backend — API endpoints (CPU), TTS generation (GPU), audio stitching (GPU). Scales to zero, per-second billing, $30/mo free tier.
- **Vercel free tier:** Hosts the React frontend. Global CDN, automatic deploys from Git.
- **No Render, no separate backend.** The entire backend is Modal.

---

## Frontend Layout

- **Empty state (no text):** FileUpload zone is shown, fixed 24px above the BottomBar. Text area is small; drag-and-drop is the primary input.
- **With text (pasted or from file):** FileUpload is hidden. Text area fills the entire left pane between the voice pill and BottomBar, with 24px padding above and below. Only the textarea scrolls.
- **Layout constants:** `frontend/src/lib/layout-constants.ts` — edit to adjust spacing. FileUpload shows only when `bottomBarStatus === "idle" && text.trim().length === 0`.

## Common Pitfalls

1. **Don't create a separate backend service** — everything runs on Modal
2. **Don't process chunks sequentially** — use Modal's `.map()` for parallel batches (except where `.cursorrules` explicitly calls for sequential processing in a single GPU container for long-form jobs)
3. **Don't use PyPDF2** — use PyMuPDF (`fitz`) for reliable PDF extraction
4. **Chunk at sentence boundaries** — don't split mid-word or mid-sentence (causes audio artifacts)
5. **Voice clips must be normalized** — inconsistent volume across clips = bad UX
6. **CORS** — Modal-hosted FastAPI must allow the Vercel frontend origin, configure early
7. **Bundle voice clips in the Modal image** — they're static assets, include them at build time

---

## Adding a New TTS Persona

See `docs/adding-voices.md` for the full step-by-step checklist.
