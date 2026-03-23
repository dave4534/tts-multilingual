# Project reference (libraries & pitfalls)

**What this is:** Engineering notes for humans and AI assistants — *not* a Cursor “Skill” file (`SKILL.md` lives elsewhere and has a different format). For workflow and MVP rules, use `.cursor/cursorrules`; for product scope, use the PRD; for the build checklist, use `TASKS.md`.

---

## Key Libraries

### Chatterbox Multilingual (TTS Engine)
- **Docs:** https://github.com/resemble-ai/chatterbox (same `chatterbox-tts` PyPI package)
- **Modal example:** https://modal.com/docs/examples/chatterbox_tts
- **Pinned in image:** `chatterbox-tts==0.1.6` — import **`from chatterbox.mtl_tts import ChatterboxMultilingualTTS`**
- **Weights:** Loaded on first **GPU** container start from HuggingFace (`hf-token` Modal secret). Not baked at CPU image-build time (multilingual checkpoint tensors are CUDA-serialized).
- **API:** `ChatterboxMultilingualTTS.from_pretrained(device=...)` then `generate(text, language_id, audio_prompt_path=..., cfg_weight=..., exaggeration=..., temperature=...)` or `prepare_conditionals` + `generate` without `audio_prompt_path` per chunk
- **Model:** 500M multilingual, MIT licensed
- **Voice cloning:** Zero-shot from reference audio clip; **reference language should match `language_id`** when possible (see upstream README for `cfg_weight=0` cross-language tips)
- **Languages:** `ar`, `da`, `de`, `el`, `en`, `es`, `fi`, `fr`, `he`, `hi`, `it`, `ja`, `ko`, `ms`, `nl`, `no`, `pl`, `pt`, `ru`, `sv`, `sw`, `tr`, `zh`
- **Chunk limit:** ~300 characters per call for stable generation — chunk and stitch longer text
- **Long text handling:** See https://github.com/devnen/Chatterbox-TTS-Server for chunking patterns

### Modal (Serverless Backend + GPU)
- **Docs:** https://modal.com/docs
- **Pricing:** Per-second billing, $30/mo free tier, A10G ~$1.10/hr
- **Key patterns:**
  - `@modal.asgi_app()` — serve a full FastAPI app on Modal (this is our backend)
  - `@modal.function()` — define CPU or GPU functions
  - `modal.Image` — define container image with dependencies (ffmpeg, pydub, PyMuPDF, etc.)
  - **TTS jobs:** Do **not** use `.map()` / `.starmap()` across GPU containers for chunk TTS — see `.cursor/cursorrules`. (`.map()` is fine for other unrelated parallel work, not our chunk pipeline.)
- **Cold starts:** API can wake quickly; **GPU** workers often take much longer on cold start — see PRD / UX copy (“Warming up…”).
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
- **Init (already done for this repo):** `npx shadcn@latest init` in `frontend/` only when bootstrapping a *new* app from scratch.

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

---

## Adding a New TTS Persona

See `docs/adding-voices.md` for the full step-by-step checklist (including **`language_ids`** per persona).

## Voice ↔ output language

- Each manifest entry may include **`language_ids`** (e.g. `["en"]`, `["he"]`). Missing → **English only**.
- The frontend only lists personas that support the **currently selected output language**; `/convert` validates the same pairing (400 if mismatched).
- **On disk:** reference WAVs and previews live under **`voices/en/`**, **`voices/he/`**, etc.; `filename` / `preview_filename` in `voices.json` are paths relative to `voices/` (e.g. `en/Dave.wav`).
