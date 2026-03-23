# PRD: Text-to-Speech Web App

## Overview

A web application that converts text into natural-sounding audio (MP3). Users paste text or upload a file, select a voice from a curated set of human-like personas, and receive a downloadable MP3 with real-time progress tracking and audio preview.

The app runs on desktop and mobile browsers, hosted on a public URL.

---

## Goals

- Allow users to convert long-form text (up to 20,000 words) into high-quality, human-sounding audio
- Provide a simple, single-page experience with no sign-up required
- Keep infrastructure costs near zero using serverless GPU and free-tier hosting
- Build a foundation that supports voice cloning, Hebrew, and user accounts in future phases

---

## User Flow

1. **Input text** — User pastes text into a large text area, OR uploads a .txt/.pdf file. If a file is uploaded, extracted text populates the text area for review/editing. A live word counter shows usage against the 20,000 word limit.

2. **Select a voice** — User browses a horizontal row of voice cards (stacks vertically on mobile). Each card shows the voice name, a short description, and a play button to preview a 6-second reference clip. One voice is pre-selected by default. Selected voice gets a highlighted border.

3. **Convert** — User clicks a large "Convert to Audio" button (disabled until text and voice are present). The button is replaced by a progress bar showing conversion percentage (e.g., "Converting... 34%").

4. **Result** — Once complete, the progress bar transforms into an audio player with play/pause, scrub bar, and timestamp. A "Download MP3" button and a "Start Over" link appear below.

---

## Voice Selection

### MVP Voice Lineup (5-10 voices)

| Voice | Description |
|---|---|
| Calm older man | Warm, steady, grandfatherly — great for audiobooks |
| Upbeat young woman | Energetic, friendly — good for articles and blogs |
| Professional man | Clear, neutral, newscaster-style |
| Professional woman | Clear, confident, corporate/presentation tone |
| Gentle young man | Soft-spoken, relaxed — good for bedtime stories |
| Warm older woman | Maternal, soothing, storytelling feel |

### How voices work

- Each voice is defined by a 6-10 second reference audio clip bundled in the Modal image
- Reference clips are sourced from open-licensed datasets: LibriVox (public domain audiobooks) and Mozilla Common Voice
- When the user selects a voice and clicks convert, the reference clip is sent to Chatterbox alongside the text
- Chatterbox uses zero-shot voice cloning to generate audio matching the reference voice

---

## Architecture

```
User's Browser (React on Vercel)
        |
        | API calls (REST)
        v
Backend on Modal (FastAPI via @modal.asgi_app)
  ├── CPU functions: file parsing, chunking, progress tracking, serving files
  └── GPU functions: Chatterbox TTS generation + audio stitching
```

### Why 2 layers (not 3)

Everything backend runs on Modal — both lightweight API endpoints (CPU) and heavy TTS generation (GPU). This eliminates a separate backend service (Render), reducing the stack to just two services: Vercel (frontend) and Modal (backend + GPU). Modal's `@modal.asgi_app()` decorator serves a full FastAPI app, so the API layer and GPU workers live in one deployment.

Benefits over a separate Render backend:
- One fewer service to manage and sign up for
- No Render cold start (which added 30-60s on top of Modal's cold start)
- No 512 MB RAM limitation — Modal has ample resources for all operations
- Simpler deployment: `modal deploy` handles everything

### Conversion pipeline

1. Frontend sends text (or uploaded file) to the Modal-hosted FastAPI backend
2. Backend (CPU function) extracts text from file if needed (PyMuPDF for PDF, built-in for TXT). PyMuPDF handles complex PDF layouts (multi-column, tables, unusual encoding) significantly better than PyPDF2.
3. Backend (CPU function) splits text into chunks (~300 characters each, Chatterbox's processing unit) and creates a job with a unique ID
4. Backend dispatches all chunks to GPU functions for parallel processing, dramatically reducing total conversion time (a 20k word job takes minutes, not hours).
5. GPU functions generate audio for each chunk. Once all chunks complete, a GPU function stitches all segments into a single MP3 using pydub/ffmpeg and stores the result.
6. During processing, the backend tracks chunk-level progress in memory with the job ID and relays it to the frontend.
7. Frontend polls the backend every 2 seconds for progress using the job ID, and displays the percentage.
8. Once the finished MP3 is ready, it is stored temporarily on Modal's ephemeral storage (30 minutes, then cleaned up) and the user can preview (play/pause) and download.

### Note on job state durability (MVP trade-off)

Job state is stored in memory on the Modal backend. If the container restarts mid-job, that job's progress is lost and the user must retry. This is an acceptable trade-off for MVP because:
- With parallel processing, most jobs complete in minutes (short exposure window)
- No additional services to set up or pay for
- Post-MVP, a free Redis service (e.g., Upstash) can be added for persistence if needed

---

## Tech Stack

| Layer | Technology | Hosting | Cost |
|---|---|---|---|
| Frontend | React + Tailwind CSS + Shadcn UI | Vercel (free tier) | $0 |
| Backend API + TTS Engine | Python / FastAPI + Chatterbox Multilingual | Modal (serverless, CPU + GPU) | ~$0-12/mo (covered by $30/mo free tier) |
| File parsing | PyMuPDF (PDF), built-in (TXT) | Runs on Modal (CPU) | included |
| Audio stitching | pydub + ffmpeg | Runs on Modal (GPU) | included |
| Voice references | LibriVox / Mozilla Common Voice clips | Bundled in Modal image | included |

### Cost estimate

At 200,000 words/month:
- ~1,333 minutes of audio output
- ~11 hours of GPU compute on Modal (Chatterbox Turbo real-time factor ~0.5)
- Modal A10G rate: ~$1.10/hr = ~$12/month
- Modal free tier: $30/month = likely covers full usage for initial months

---

## Error Handling

| Scenario | User Experience |
|---|---|
| Unsupported file format | "Please upload a .txt or .pdf file" |
| Text exceeds 20,000 words | Word counter turns red, Convert button stays disabled |
| PDF text extraction fails (e.g., scanned image) | "We couldn't extract text from this PDF. Try pasting the text directly." |
| Modal cold-starting (containers scale to zero when idle) | First request may take a few seconds. Frontend shows "Warming up..." until the backend responds. |
| Chunk fails mid-generation | Backend retries up to 3 times silently. On continued failure: "Something went wrong. Please try again." with retry button |
| Network disconnection during conversion | "Connection lost. Please try again." (MVP does not persist job state across restarts) |
| Upload file too large (>10 MB) | "File is too large. Please upload a file under 10 MB." |
| Empty text submitted | Convert button stays disabled |

---

## UI Design Direction

**Style:** Warm and friendly — soft colors, rounded corners, approachable feel. Inspired by Spotify and Duolingo.

**Layout:** Single page, top-to-bottom flow:
1. Input area (text box + file upload)
2. Voice selection cards
3. Convert button / progress bar
4. Audio player + download

**Responsive behavior:**
- Desktop: voice cards in a horizontal row, text area is wide
- Mobile: voice cards stack vertically, all elements full-width

---

## MVP Scope

### Included
- Paste text or upload .txt/.pdf
- 5-10 curated English voice personas with preview
- Convert up to 20,000 words to MP3
- Progress bar with percentage during conversion
- Audio preview player (play/pause, scrub, timestamp)
- MP3 download
- Responsive desktop + mobile layout
- Public URL hosting

### Explicitly excluded from MVP
- Voice cloning (upload your own voice)
- Hebrew language support
- User accounts / sign-up / saved history
- 50,000 word limit
- DOCX file support
- Batch/queue system for concurrent users
- Payment or rate limiting

---

## Future Phases

### Phase 2: Voice Cloning
- "Upload your own voice" option alongside preset voices
- User uploads a short audio clip (6-30 seconds)
- Chatterbox uses it as a reference for zero-shot voice cloning
- Cloned voice is available for that session only (no persistence without accounts)

### Phase 3: Hebrew Support
- Chatterbox Multilingual already supports Hebrew
- Add Hebrew voice reference clips (source from datasets)
- Add RTL text handling in the UI
- Language selector toggle (English / Hebrew)

### Phase 4: User Accounts
- Sign up / login (email or OAuth)
- Save conversion history
- Persist custom cloned voices across sessions
- Usage dashboard

### Phase 5: Scale
- Increase word limit to 50,000
- Optimize chunking and batching for longer texts
- Add queue system for concurrent users
- Rate limiting and/or payment tiers if needed

---

## Key Decisions Log

| Decision | Chosen | Rationale |
|---|---|---|
| TTS library | Chatterbox Multilingual | Only free, open-source option with English + Hebrew + voice cloning in one package. 63.75% preferred over ElevenLabs in blind tests. MIT licensed. |
| Backend + GPU hosting | Modal (serverless) | $30/mo free tier likely covers all usage. Official Chatterbox deployment example. Per-second billing. Scales to zero. Hosts both API and GPU functions — eliminates need for a separate backend service. |
| Frontend hosting | Vercel (free) | Best free hosting for React apps. Global CDN. |
| PDF parsing | PyMuPDF (replaces PyPDF2) | Handles complex layouts, multi-column, tables. Peer review flagged PyPDF2 as unreliable. |
| Chunk processing | Parallel batches on Modal | Peer review flagged sequential processing as too slow. Parallel fan-out reduces 20k word jobs from hours to minutes. |
| Job state persistence (MVP) | In-memory only, no Redis | Acceptable for MVP given short job times. Avoids extra service setup. Add Upstash Redis post-MVP if needed. |
| Rate limiting (MVP) | None | Not needed until app has public traffic. Add post-MVP. |
| Voice sourcing | LibriVox + Mozilla Common Voice | Open-licensed, free, diverse speaker pool. |
| Visual style | Warm and friendly | User preference. Soft colors, rounded corners, approachable. |
| Auth (MVP) | None | Single-use tool for MVP. No sign-up friction. |
