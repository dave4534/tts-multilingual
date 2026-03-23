# Changelog

All notable changes to this project will be documented in this file.
Format: `[Task ID] One-line summary`

---

## Recent

- [UI] Minor UI adjustments: light mode white backgrounds (left-pane, voice cards, semantic tokens); dark mode neutral-950 for left-pane and voice cards; scroll thumb neutral-300/700; avatar circles fixed 300-shade palette; header/footer/sidebar neutral-50 light; drag-drop neutral-50/900
- [voice] Added Vered persona (Vered.wav), removed Upbeat young woman

---

## MVP Build

- [0.1] Created `.gitignore` (Node, Python, .env, __pycache__, build outputs, IDE/OS)
- [0.2] Scaffolded React frontend with Vite + Tailwind CSS + Shadcn UI in `/frontend`
- [0.3] Modal CLI verified; `hello.py` runs successfully on Modal
- [0.5] Created `/modal_app` (placeholder main.py) and `/voices` (README for clip storage)
- [1.1] ChatterboxTTS GPU class: loads model, generate(text, voice_path) → WAV bytes; sample voices in image; requires `hf-token` secret
- [1.2] Single-chunk TTS test passed; `modal run modal_app/main.py` produces /tmp/tts-output.wav
- [1.3] Added generate_batch(): accepts list of chunks, processes via starmap, returns ordered WAV segments; `modal run modal_app/main.py::test_batch` writes chunk_000.wav … to /tmp/tts-batch/
- [1.4] Added stitch() and generate_and_stitch(); pydub concatenates WAV segments to single MP3; `modal run modal_app/main.py::test_pipeline` produces /tmp/tts-output.mp3
- [1.5] Added generate_and_stitch_with_progress(): yields progress per chunk; `modal run modal_app/main.py::test_progress` writes /tmp/tts-output-progress.mp3
- [1.6] Full pipeline test: chunk_text() at sentence boundaries, test_full_pipeline with 1,000+ words → 22 chunks → stitched MP3; `modal run modal_app/main.py::test_full_pipeline` produces /tmp/tts-full-output.mp3
- [2.1] Created docs/phase2-voice-research-guide.md: LibriVox and Mozilla Common Voice browse/search strategies per persona
- [2.2] Added voices/extract_clip.py: extract 6-10s segments from source audio (pydub)
- [2.3] Added voices/normalize_clips.py: normalize to target dBFS for consistent volume
- [2.4] Defined clip filenames: calm-older-man.wav, upbeat-young-woman.wav, etc.
- [2.5] Created voices/voices.json manifest (id, name, description, filename per voice)
- [2.6] Added test_voice entrypoint; voices/ mounted at /voices-custom in Modal image
- [3.1–3.2] FastAPI app via @modal.asgi_app(label="tts-api"), GET /health
- [3.3] POST /convert: JSON text + voice_id, word limit 20k, returns job_id; Modal Dict for job store
- [3.4–3.5] File upload: multipart file+voice_id, .txt/.pdf, 10MB; PyMuPDF for PDF extraction
- [3.6–3.10] Chunking, GPU dispatch (run_tts_pipeline.spawn), status and download endpoints; full convert flow
- [3.11] GET /voices returns manifest (id, name, description, preview_url); GET /voices/preview/{voice_id} serves WAV clips
- [3.12] cleanup_old_jobs cron: deletes completed MP3s older than 30 min (Modal Dict stores list under `_completed`, no .items())
- [3.13] generate() retries=3; pipeline errors return "Something went wrong. Please try again."
- [3.14] CORS: allow_origins from FRONTEND_ORIGIN env (default "*"); set via Modal secret for production
- [3.15] test_e2e local entrypoint: POST /convert → poll status → download MP3
- [4.1–4.10] Phase 4 frontend: text input + word counter, file upload (txt/pdf), voice selector with preview, convert button, progress bar, audio player, download + Start Over; API wiring; warm amber design
- [0.3] Set up Modal account and installed `modal` CLI
- [3.16–3.18] Long-form helpers: section splitting, parent/section job shapes, and progress aggregation with unit tests
- [3.19] Long-form parent/section pipelines wired into `/convert` for >1k-word jobs, with section and parent status/tests
- [2.7] First curated persona voices added using Ram-Dass and Dave reference clips (`Ram-Dass.wav`, `Dave.wav`), with synthetic preview demos generated via shared sentence
- [3.11] Add optional Chatterbox conditioning params (`cfg_weight`/`exaggeration`/`temperature`) for tuned previews and rename the `aba` persona card to "Gentle young man"
- [4.14] Voicecraft UI polish: FileUpload full-width match; voice cards gray hover, white bg, no waveform icon, checkmark top-right
- [4.15] Redesign of entire UI: consistent 24px left alignment (title, subtitle, selected voice, placeholder, drag-drop), upload zone 40px above bottom bar, removed stray footer border, theme toggle
- [4.16] Layout: show FileUpload only when text empty; when text pasted, hide upload zone and text area fills pane with 24px gap above bottom bar; added layout-constants.ts for spacing
- Added Mikey persona voice: voices/Mikey.wav, registered in voices.json with synthetic preview (mikey-preview.mp3)
