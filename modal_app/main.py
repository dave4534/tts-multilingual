"""
TTS Web App — Modal backend.

FastAPI API (via @modal.asgi_app) + Chatterbox GPU workers.
Serves file parsing, chunking, TTS generation, and audio stitching.
"""

import hashlib
import io
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import modal


SECTION_MAX_WORDS = 1000


@dataclass
class SectionSpec:
    parent_id: str
    section_id: str
    index: int
    text: str


def _normalize_text(text: str) -> str:
    """Collapse whitespace/newlines so TTS model gets clean prose."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n+", " ", text)      # newlines → space
    text = re.sub(r" {2,}", " ", text)    # multiple spaces → one
    return text.strip()


def chunk_text(text: str, max_chars: int = 1000) -> list[str]:
    """
    Split text into chunks of ~max_chars, breaking at sentence boundaries.
    """
    text = _normalize_text(text)
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for s in sentences:
        s_len = len(s) + 1
        if current_len + s_len > max_chars and current:
            chunks.append(" ".join(current))
            current = []
            current_len = 0
        current.append(s)
        current_len += s_len
    if current:
        chunks.append(" ".join(current))
    return chunks


def split_text_into_sections(text: str, max_words: int = SECTION_MAX_WORDS) -> List[str]:
    """Split text into ~max_words word sections, preserving order.
    """
    words = _normalize_text(text).split()
    if not words:
        return []
    sections: List[str] = []
    current: List[str] = []
    for w in words:
        current.append(w)
        if len(current) >= max_words:
            sections.append(" ".join(current))
            current = []
    if current:
        sections.append(" ".join(current))
    return sections


def build_parent_and_section_jobs(
    parent_id: str,
    text: str,
    voice_id: str,
    max_words: int = SECTION_MAX_WORDS,
) -> Tuple[Dict, List[Dict]]:
    """Pure helper to construct parent + section job dicts for long-form input.

    This does not touch Modal state; callers are responsible for writing the
    returned dicts into `job_store`.
    """
    section_texts = split_text_into_sections(text, max_words=max_words)
    parent_job: Dict = {
        "id": parent_id,
        "kind": "parent",
        "text": text,
        "voice_id": voice_id,
        "state": "queued",
        "progress": 0,
        "error": None,
        "mp3": None,
        "section_ids": [f"{parent_id}:section:{i}" for i in range(len(section_texts))],
    }
    section_jobs: List[Dict] = []
    for index, section_text in enumerate(section_texts):
        section_id = f"{parent_id}:section:{index}"
        section_jobs.append(
            {
                "id": section_id,
                "kind": "section",
                "parent_id": parent_id,
                "index": index,
                "text": section_text,
                "voice_id": voice_id,
                "state": "queued",
                "progress": 0,
                "error": None,
                "mp3": None,
            }
        )
    return parent_job, section_jobs


def compute_parent_progress(section_jobs: List[Dict]) -> int:
    """Aggregate parent progress as the average of section progresses."""
    if not section_jobs:
        return 0
    total = sum(int(job.get("progress", 0)) for job in section_jobs)
    return int(total / len(section_jobs))


def summarize_parent_state(parent_job: Dict, section_jobs: List[Dict]) -> Dict:
    """Compute aggregate state/progress/error for a parent job from its sections."""
    if not section_jobs:
        return {
            "state": parent_job.get("state", "queued"),
            "progress": parent_job.get("progress", 0),
            "error": parent_job.get("error"),
        }
    states = [j.get("state", "queued") for j in section_jobs]
    errors = [j.get("error") for j in section_jobs if j.get("error")]
    if any(s == "failed" for s in states):
        state = "failed"
        error = errors[0] if errors else parent_job.get("error")
    elif all(s == "complete" for s in states):
        state = "complete"
        error = None
    elif any(s in ("processing", "warming_up") for s in states):
        state = "processing"
        error = None
    elif all(s == "queued" for s in states):
        state = "queued"
        error = None
    else:
        # Mixed but not failed/complete/processing → treat as processing
        state = "processing"
        error = None
    progress = compute_parent_progress(section_jobs)
    return {
        "state": state,
        "progress": progress,
        "error": error,
    }

# Image: Chatterbox TTS + voice prompts
# Download sample voices at build time (Lucy.wav) for testing until /voices has real clips
CHATTERBOX_VOICES_URL = "https://modal-cdn.com/blog/audio/chatterbox-tts-voices.zip"
VOICES_DIR = "/voices"

VOICES_CUSTOM_PATH = "/voices-custom"


def _download_chatterbox_weights():
    """Download Chatterbox model weights at image build time. Baked into image to eliminate HF download on cold start."""
    from chatterbox.tts import ChatterboxTTS

    ChatterboxTTS.from_pretrained(device="cpu")  # Caches weights to disk; no GPU needed


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("wget", "unzip", "ffmpeg")
    .run_commands(
        f"mkdir -p {VOICES_DIR} && "
        f"wget -q {CHATTERBOX_VOICES_URL} -O /tmp/voices.zip && "
        f"unzip -q -o /tmp/voices.zip -d {VOICES_DIR} && "
        f"rm /tmp/voices.zip"
    )
    .run_commands(
        "pip install numpy && pip install --no-build-isolation chatterbox-tts==0.1.3 pydub torch torchaudio"
    )
    .run_function(_download_chatterbox_weights, secrets=[modal.Secret.from_name("hf-token")])
    .add_local_dir("voices", VOICES_CUSTOM_PATH)
)

app = modal.App("tts-multilingual", image=image)

# Lightweight image for FastAPI (CPU)
MAX_FILE_MB = 10
MAX_WORDS = 20_000

# Hash voices.json at build time so image rebuilds when it changes (avoids stale cache)
_VOICES_JSON_PATH = Path(__file__).resolve().parent.parent / "voices" / "voices.json"
_VOICES_HASH = hashlib.sha256(_VOICES_JSON_PATH.read_bytes()).hexdigest()[:12] if _VOICES_JSON_PATH.exists() else "unknown"

web_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.115.6",
        "uvicorn[standard]==0.32.1",
        "python-multipart==0.0.18",
        "pymupdf==1.25.1",
    )
    .add_local_dir("voices", "/voices", copy=True)
    .run_commands(f"echo voices-hash-{_VOICES_HASH} && sha256sum /voices/voices.json | cut -c1-12")
)

job_store = modal.Dict.from_name("tts-jobs", create_if_missing=True)

DEFAULT_VOICE_PATH = f"{VOICES_DIR}/chatterbox-tts-voices/prompts/Lucy.wav"


def extract_text_from_bytes(content: bytes, filename: str) -> str:
    """Extract text from file content. Raises ValueError on size/format error."""
    if len(content) > MAX_FILE_MB * 1024 * 1024:
        raise ValueError(f"File exceeds {MAX_FILE_MB} MB limit.")
    suffix = Path(filename).suffix.lower()
    if suffix == ".txt":
        return content.decode("utf-8", errors="replace")
    if suffix == ".pdf":
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        try:
            return "\n".join(page.get_text() for page in doc)
        finally:
            doc.close()
    raise ValueError("Please upload a .txt or .pdf file")


def _resolve_voice_path(voice_id: str) -> str:
    if voice_id == "lucy":
        return DEFAULT_VOICE_PATH
    data = json.loads(Path("/voices/voices.json").read_text())
    for v in data["voices"]:
        if v["id"] == voice_id:
            return f"{VOICES_CUSTOM_PATH}/{v['filename']}"
    raise ValueError(f"Unknown voice_id: {voice_id}")


@app.function(image=web_image, timeout=3600)
def run_tts_pipeline(job_id: str) -> None:
    """Run TTS pipeline for a job: chunk, generate, stitch, update job_store."""
    job = job_store.get(job_id)
    if not job:
        return
    try:
        job_store[job_id] = {**job, "state": "warming_up", "progress": 0}
        text = job["text"]
        voice_id = job["voice_id"]
        voice_path = _resolve_voice_path(voice_id)
        chunks = chunk_text(text)
        if not chunks:
            job_store[job_id] = {**job, "state": "failed", "error": "No text to convert"}
            return
        job_store[job_id] = {**job, "state": "processing", "progress": 0}
        cfg_weight = job.get("cfg_weight")
        exaggeration = job.get("exaggeration")
        temperature = job.get("temperature")
        tts = ChatterboxTTS()
        mp3_bytes = b""
        if cfg_weight is None and exaggeration is None and temperature is None:
            updates = tts.generate_and_stitch_with_progress.remote_gen(chunks, voice_path)
        else:
            updates = tts.generate_and_stitch_with_progress.remote_gen(
                chunks,
                voice_path,
                cfg_weight=cfg_weight if cfg_weight is not None else 0.5,
                exaggeration=exaggeration if exaggeration is not None else 0.5,
                temperature=temperature if temperature is not None else 0.8,
            )
        for update in updates:
            if "mp3" in update and update["mp3"]:
                mp3_bytes = update["mp3"]
                job_store[job_id] = {
                    **job,
                    "state": "complete",
                    "progress": 100,
                    "mp3": mp3_bytes,
                }
            else:
                job_store[job_id] = {
                    **job,
                    "state": "processing",
                    "progress": update["progress"],
                }
        import time

        entries = completed_jobs.get(COMPLETED_JOBS_KEY, [])
        entries.append((job_id, time.time()))
        completed_jobs[COMPLETED_JOBS_KEY] = entries
    except BaseException as e:
        # Surface backend error for debugging long-running jobs.
        msg = str(e) or "Something went wrong. Please try again."
        job_store[job_id] = {
            **job,
            "state": "failed",
            "error": msg,
        }


@app.function(image=web_image, timeout=3600)
def run_section_pipeline(section_id: str) -> None:
    """Run TTS pipeline for a single section job."""
    job = job_store.get(section_id)
    if not job:
        return
    if job.get("kind") != "section":
        # Defensive: only operate on section jobs
        return
    try:
        # Warming up
        job_store[section_id] = {**job, "state": "warming_up", "progress": 0}
        text = job["text"]
        voice_id = job["voice_id"]
        voice_path = _resolve_voice_path(voice_id)
        chunks = chunk_text(text)
        if not chunks:
            job_store[section_id] = {
                **job,
                "state": "failed",
                "error": "No text to convert",
            }
            return
        job_store[section_id] = {**job, "state": "processing", "progress": 0}
        cfg_weight = job.get("cfg_weight")
        exaggeration = job.get("exaggeration")
        temperature = job.get("temperature")
        tts = ChatterboxTTS()
        mp3_bytes = b""
        if cfg_weight is None and exaggeration is None and temperature is None:
            updates = tts.generate_and_stitch_with_progress.remote_gen(chunks, voice_path)
        else:
            updates = tts.generate_and_stitch_with_progress.remote_gen(
                chunks,
                voice_path,
                cfg_weight=cfg_weight if cfg_weight is not None else 0.5,
                exaggeration=exaggeration if exaggeration is not None else 0.5,
                temperature=temperature if temperature is not None else 0.8,
            )
        for update in updates:
            if "mp3" in update and update["mp3"]:
                mp3_bytes = update["mp3"]
                job_store[section_id] = {
                    **job,
                    "state": "complete",
                    "progress": 100,
                    "mp3": mp3_bytes,
                }
            else:
                job_store[section_id] = {
                    **job,
                    "state": "processing",
                    "progress": update["progress"],
                }
        import time

        entries = completed_jobs.get(COMPLETED_JOBS_KEY, [])
        entries.append((section_id, time.time()))
        completed_jobs[COMPLETED_JOBS_KEY] = entries
    except BaseException as e:
        msg = str(e) or "Something went wrong. Please try again."
        job_store[section_id] = {
            **job,
            "state": "failed",
            "error": msg,
        }


@app.function(image=web_image)
@modal.asgi_app(label="tts-multilingual-api")
def web() -> "FastAPI":
    """FastAPI app served on Modal (Phase 3)."""
    import uuid

    from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    from pydantic import BaseModel, Field

    import os

    origin_str = os.environ.get("FRONTEND_ORIGIN", "*").strip()
    allow_origins = (
        ["*"] if origin_str == "*" else [o.strip() for o in origin_str.split(",")]
    )
    api = FastAPI(title="TTS Web App API")
    api.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,  # Set FRONTEND_ORIGIN in Modal secret for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/voices")
    def list_voices() -> dict:
        from fastapi.responses import Response

        voices = _load_voices()
        result = []
        for v in voices:
            if v.get("builtin"):
                preview_name = v.get("preview_filename", "lucy-preview.mp3")
                preview_path = Path(f"/voices/{preview_name}")
                result.append({
                    "id": v["id"],
                    "name": v["name"],
                    "description": v["description"],
                    "preview_url": f"/voices/preview/{v['id']}" if preview_path.exists() else None,
                    "enabled": True,
                })
            else:
                preview_name = v.get("preview_filename") or v["filename"]
                preview_path = Path(f"/voices/{preview_name}")
                voice_path = Path(f"/voices/{v['filename']}")
                result.append({
                    "id": v["id"],
                    "name": v["name"],
                    "description": v["description"],
                    "preview_url": f"/voices/preview/{v['id']}" if preview_path.exists() else None,
                    "enabled": voice_path.exists(),
                })
        return Response(
            content=json.dumps({"voices": result}),
            media_type="application/json",
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    @api.get("/voices/preview/{voice_id}")
    def voice_preview(voice_id: str):
        if voice_id == "lucy":
            path = Path("/voices/lucy-preview.mp3")
            if not path.exists():
                raise HTTPException(404, "Lucy preview not available")
            media_type = "audio/mpeg" if path.suffix.lower() == ".mp3" else "audio/wav"
            return FileResponse(
                path,
                media_type=media_type,
                headers={"Cache-Control": "no-store"},
            )
        voices = _load_voices()
        voice = next((v for v in voices if v["id"] == voice_id), None)
        if not voice:
            raise HTTPException(404, "Voice not found")
        preview_name = voice.get("preview_filename") or voice["filename"]
        path = Path(f"/voices/{preview_name}")
        if not path.exists():
            raise HTTPException(404, "Preview clip not found")
        media_type = "audio/mpeg" if path.suffix.lower() == ".mp3" else "audio/wav"
        return FileResponse(
            path,
            media_type=media_type,
            headers={"Cache-Control": "no-store"},
        )

    class ConvertRequest(BaseModel):
        text: str
        voice_id: str
        cfg_weight: float | None = Field(default=None, ge=0.0, le=2.0)
        exaggeration: float | None = Field(default=None, ge=0.0, le=2.0)
        temperature: float | None = Field(default=None, ge=0.0, le=2.0)

    def _load_voices() -> list[dict]:
        data = json.loads(Path("/voices/voices.json").read_text())
        return data["voices"]

    def _validate_voice_id(voice_id: str) -> None:
        voices = _load_voices()
        if not any(v["id"] == voice_id for v in voices):
            raise HTTPException(400, f"Unknown voice_id: {voice_id}")

    def _extract_text_from_file(file: UploadFile) -> str:
        file.file.seek(0)
        content = file.file.read()
        try:
            return extract_text_from_bytes(content, file.filename or "")
        except ValueError as e:
            raise HTTPException(400, str(e))

    @api.post("/extract-text")
    async def extract_text(file: UploadFile = File(...)) -> dict[str, str]:
        """Extract text from .txt or .pdf for preview. Returns { text: string }."""
        try:
            text = _extract_text_from_file(file)
            return {"text": text}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                400,
                "We couldn't extract text from this PDF. Try pasting the text directly.",
            )

    def _process_convert(
        text: str,
        voice_id: str,
        cfg_weight: float | None = None,
        exaggeration: float | None = None,
        temperature: float | None = None,
    ) -> dict[str, str]:
        text = text.strip()
        if not text:
            raise HTTPException(400, "Text is required")
        word_count = len(text.split())
        if word_count > MAX_WORDS:
            raise HTTPException(
                400,
                f"Text exceeds {MAX_WORDS:,} word limit. You have {word_count:,} words.",
            )
        _validate_voice_id(voice_id)

        # For shorter texts, keep existing single-job behavior.
        if word_count <= SECTION_MAX_WORDS:
            job_id = str(uuid.uuid4())
            job_store[job_id] = {
                "state": "queued",
                "progress": 0,
                "text": text,
                "voice_id": voice_id,
                **({"cfg_weight": cfg_weight} if cfg_weight is not None else {}),
                **({"exaggeration": exaggeration} if exaggeration is not None else {}),
                **({"temperature": temperature} if temperature is not None else {}),
            }
            run_tts_pipeline.spawn(job_id)
            return {"job_id": job_id}

        # Long-form: create parent + section jobs and spawn section pipelines.
        parent_id = str(uuid.uuid4())
        parent_job, section_jobs = build_parent_and_section_jobs(
            parent_id, text, voice_id, max_words=SECTION_MAX_WORDS
        )
        if cfg_weight is not None:
            parent_job["cfg_weight"] = cfg_weight
            for section in section_jobs:
                section["cfg_weight"] = cfg_weight
        if exaggeration is not None:
            parent_job["exaggeration"] = exaggeration
            for section in section_jobs:
                section["exaggeration"] = exaggeration
        if temperature is not None:
            parent_job["temperature"] = temperature
            for section in section_jobs:
                section["temperature"] = temperature
        job_store[parent_id] = parent_job
        for section in section_jobs:
            job_store[section["id"]] = section
            run_section_pipeline.spawn(section["id"])
        return {"job_id": parent_id}

    @api.post("/convert")
    async def convert(
        request: Request,
        file: UploadFile | None = File(None),
        voice_id: str | None = Form(None),
        cfg_weight: float | None = Form(None),
        exaggeration: float | None = Form(None),
        temperature: float | None = Form(None),
    ) -> dict[str, str]:
        if file is not None and voice_id is not None:
            text = _extract_text_from_file(file)
            return _process_convert(
                text,
                voice_id,
                cfg_weight=cfg_weight,
                exaggeration=exaggeration,
                temperature=temperature,
            )
        content_type = (request.headers.get("Content-Type") or "").lower()
        if "application/json" in content_type:
            body = await request.json()
            req = ConvertRequest.model_validate(body)
            return _process_convert(
                req.text,
                req.voice_id,
                cfg_weight=req.cfg_weight,
                exaggeration=req.exaggeration,
                temperature=req.temperature,
            )
        raise HTTPException(
            400,
            "Provide JSON {text, voice_id} or multipart form with file + voice_id.",
        )

    @api.get("/job/{job_id}/status")
    def job_status(job_id: str) -> dict:
        job = job_store.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found")

        # Parent jobs aggregate section states/progress.
        if job.get("kind") == "parent":
            section_ids = job.get("section_ids", [])
            section_jobs = [job_store.get(sid) for sid in section_ids if job_store.get(sid)]
            summary = summarize_parent_state(job, section_jobs)

            # Persist aggregated state back onto the parent job so downloads
            # can see when the parent is actually complete.
            updated_parent = {
                **job,
                "state": summary.get("state", job.get("state")),
                "progress": summary.get("progress", job.get("progress", 0)),
                "error": summary.get("error", job.get("error")),
            }
            job_store[job_id] = updated_parent

            return {
                "job_id": job_id,
                "state": summary["state"],
                "progress": summary["progress"],
                "error": summary["error"],
            }

        # Legacy / single-job behavior.
        return {
            "job_id": job_id,
            "state": job.get("state", "queued"),
            "progress": job.get("progress", 0),
            "error": job.get("error"),
        }

    @api.get("/job/{job_id}/download")
    def job_download(job_id: str):
        from fastapi.responses import Response

        job = job_store.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found")

        # Parent job: stitch completed section MP3s into a single MP3.
        if job.get("kind") == "parent":
            if job.get("state") != "complete":
                raise HTTPException(400, "Job not complete")
            # If we've already cached the stitched MP3, return it.
            if job.get("mp3"):
                return Response(content=job["mp3"], media_type="audio/mpeg")
            section_ids = job.get("section_ids", [])
            section_jobs = [job_store.get(sid) for sid in section_ids if job_store.get(sid)]
            if not section_jobs or not all(s.get("state") == "complete" for s in section_jobs):
                raise HTTPException(400, "Job not complete")
            segments = [s.get("mp3") or b"" for s in section_jobs]
            if not all(segments):
                raise HTTPException(404, "MP3 not available")
            # Simple byte-wise concatenation of section MP3s.
            combined = b"".join(segments)
            updated = {**job, "mp3": combined}
            job_store[job_id] = updated

            return Response(content=combined, media_type="audio/mpeg")

        # Legacy / single-job download.
        if job.get("state") != "complete":
            raise HTTPException(400, "Job not complete")
        mp3 = job.get("mp3")
        if not mp3:
            raise HTTPException(404, "MP3 not available")
        return Response(content=mp3, media_type="audio/mpeg")

    return api


# Track completed jobs for cleanup
COMPLETED_JOBS_KEY = "_completed"
completed_jobs = modal.Dict.from_name("tts-completed-jobs", create_if_missing=True)


@app.function(image=web_image, schedule=modal.Cron("*/10 * * * *"))  # every 10 min
def cleanup_old_jobs() -> None:
    """Delete completed MP3s older than 30 minutes."""
    import time

    cutoff = time.time() - (30 * 60)
    entries = completed_jobs.get(COMPLETED_JOBS_KEY, [])
    kept = []
    for jid, ts in entries:
        if ts >= cutoff:
            kept.append((jid, ts))
        else:
            job = job_store.get(jid)
            if job:
                job_store[jid] = {**job, "mp3": None}
    completed_jobs[COMPLETED_JOBS_KEY] = kept


with image.imports():
    from pydub import AudioSegment  # noqa: E402
    import torchaudio  # noqa: E402


@app.cls(
    gpu="a10g",
    image=image,
    secrets=[modal.Secret.from_name("hf-token")],
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
)
class ChatterboxTTS:
    """GPU-backed TTS: generates audio from text + voice reference clip."""

    @modal.enter(snap=True)
    def load_model(self) -> None:
        from chatterbox.tts import ChatterboxTTS as _ChatterboxTTS

        self.model = _ChatterboxTTS.from_pretrained(device="cuda")

    @modal.method()
    def generate(
        self,
        text: str,
        voice_path: str,
        cfg_weight: float = 0.5,
        exaggeration: float = 0.5,
        temperature: float = 0.8,
    ) -> bytes:
        """
        Generate audio from a text chunk and voice reference clip.

        Args:
            text: Input text (up to ~1000 chars per chunk).
            voice_path: Path to 6-10 second WAV reference clip.
            cfg_weight: Conditioning strength for the reference clip.
            exaggeration: Emotion/prosody exaggeration parameter.
            temperature: Sampling temperature.

        Returns:
            WAV audio as bytes.
        """
        wav = self.model.generate(
            text,
            audio_prompt_path=voice_path,
            cfg_weight=cfg_weight,
            exaggeration=exaggeration,
            temperature=temperature,
        )
        buffer = io.BytesIO()
        torchaudio.save(buffer, wav, self.model.sr, format="wav")
        buffer.seek(0)
        return buffer.read()

    @modal.method()
    def generate_batch(
        self,
        chunks: list[str],
        voice_path: str,
        cfg_weight: float = 0.5,
        exaggeration: float = 0.5,
        temperature: float = 0.8,
    ) -> list[bytes]:
        """
        Generate audio for multiple chunks in parallel; returns segments in input order.

        Args:
            chunks: List of text chunks (each up to ~1000 chars).
            voice_path: Path to 6-10 second WAV reference clip.
            cfg_weight: Conditioning strength for the reference clip.
            exaggeration: Emotion/prosody exaggeration parameter.
            temperature: Sampling temperature.

        Returns:
            List of WAV audio bytes, one per chunk, in the same order as chunks.
        """
        if not chunks:
            return []
        inputs = [
            (chunk, voice_path, cfg_weight, exaggeration, temperature)
            for chunk in chunks
        ]
        return list(self.generate.starmap(inputs, order_outputs=True))

    @modal.method()
    def stitch(self, wav_segments: list[bytes]) -> bytes:
        """
        Concatenate WAV segments into a single MP3.

        Args:
            wav_segments: List of WAV audio bytes in order.

        Returns:
            Single MP3 as bytes.
        """
        if not wav_segments:
            return b""
        combined = AudioSegment.empty()
        for wav_bytes in wav_segments:
            segment = AudioSegment.from_wav(io.BytesIO(wav_bytes))
            combined += segment
        buffer = io.BytesIO()
        combined.export(buffer, format="mp3")
        buffer.seek(0)
        return buffer.read()

    @modal.method()
    def generate_and_stitch(
        self,
        chunks: list[str],
        voice_path: str,
        cfg_weight: float = 0.5,
        exaggeration: float = 0.5,
        temperature: float = 0.8,
    ) -> bytes:
        """
        Generate TTS for chunks in parallel, then stitch into a single MP3.

        Args:
            chunks: List of text chunks (each up to ~1000 chars).
            voice_path: Path to 6-10 second WAV reference clip.
            cfg_weight: Conditioning strength for the reference clip.
            exaggeration: Emotion/prosody exaggeration parameter.
            temperature: Sampling temperature.

        Returns:
            Single MP3 as bytes.
        """
        segments = self.generate_batch.local(
            chunks, voice_path, cfg_weight, exaggeration, temperature
        )
        return self.stitch.local(segments)

    @modal.method()
    def generate_and_stitch_with_progress(
        self,
        chunks: list[str],
        voice_path: str,
        cfg_weight: float = 0.5,
        exaggeration: float = 0.5,
        temperature: float = 0.8,
    ):
        """
        Generate TTS for chunks in parallel, stitch to MP3, yield progress per chunk.

        Yields:
            {"progress": int, "chunk": int, "total": int} for each chunk completed.
            Final yield: {"progress": 100, "chunk": total, "total": total, "mp3": bytes}.
        """
        if not chunks:
            yield {"progress": 100, "chunk": 0, "total": 0, "mp3": b""}
            return
        n = len(chunks)

        # Load voice reference once — avoids re-processing WAV per chunk
        import torch
        self.model.prepare_conditionals(voice_path, exaggeration=exaggeration)

        segments: list[bytes] = []
        for i, chunk in enumerate(chunks):
            print(f"[TTS] chunk {i+1}/{n} start: {chunk[:60]!r}", flush=True)
            wav = self.model.generate(
                chunk,
                cfg_weight=cfg_weight,
                exaggeration=exaggeration,
                temperature=temperature,
            )
            print(f"[TTS] chunk {i+1}/{n} done", flush=True)
            torch.cuda.empty_cache()
            buf = io.BytesIO()
            torchaudio.save(buf, wav, self.model.sr, format="wav")
            buf.seek(0)
            segments.append(buf.read())
            progress = int(100 * (i + 1) / n)
            yield {"progress": progress, "chunk": i + 1, "total": n}
        mp3 = self.stitch.local(segments)
        yield {"progress": 100, "chunk": n, "total": n, "mp3": mp3}

    @modal.method()
    def generate_cfg_sweep(
        self,
        text: str,
        voice_path: str,
        cfg_weights: list[float],
        exaggeration: float = 0.5,
        temperature: float = 0.8,
    ) -> dict[str, bytes]:
        """
        Generate an MP3 per cfg_weight for a single text prompt.

        Intended for voice-specific conditioning experiments (accent drift).
        """
        if not cfg_weights:
            return {}

        import torch

        # Prepare conditionals once; cfg_weight is applied during generate.
        self.model.prepare_conditionals(voice_path, exaggeration=exaggeration)
        results: dict[str, bytes] = {}

        for cfg_weight in cfg_weights:
            print(f"[cfg_sweep] cfg_weight={cfg_weight}", flush=True)
            wav = self.model.generate(
                text,
                cfg_weight=cfg_weight,
                exaggeration=exaggeration,
                temperature=temperature,
            )
            torch.cuda.empty_cache()

            buf = io.BytesIO()
            torchaudio.save(buf, wav, self.model.sr, format="wav")
            wav_bytes = buf.getvalue()
            mp3_bytes = self.stitch.local([wav_bytes])
            results[str(cfg_weight)] = mp3_bytes

        return results


# Default voice path inside the container (zip extracts to /voices/chatterbox-tts-voices/prompts/)
DEFAULT_VOICE_PATH = f"{VOICES_DIR}/chatterbox-tts-voices/prompts/Lucy.wav"


@app.local_entrypoint()
def test(
    prompt: str = "Hello from the TTS web app. Chatterbox is running on Modal.",
    output_path: str = "/tmp/tts-output.wav",
) -> None:
    """Test single-chunk generation (task 1.2)."""
    tts = ChatterboxTTS()
    print(f"Generating with voice: {DEFAULT_VOICE_PATH}")
    audio_bytes = tts.generate.remote(prompt, DEFAULT_VOICE_PATH)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(audio_bytes)
    print(f"Saved to {output_path}")


@app.local_entrypoint()
def test_batch(
    output_dir: str = "/tmp/tts-batch",
) -> None:
    """Test parallel batch generation (task 1.3)."""
    chunks = [
        "First chunk: Hello from the TTS web app.",
        "Second chunk: Chatterbox is running on Modal.",
        "Third chunk: Batch processing in parallel.",
    ]
    tts = ChatterboxTTS()
    print(f"Generating {len(chunks)} chunks in parallel with voice: {DEFAULT_VOICE_PATH}")
    segments = tts.generate_batch.remote(chunks, DEFAULT_VOICE_PATH)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, audio_bytes in enumerate(segments):
        path = out_dir / f"chunk_{i:03d}.wav"
        path.write_bytes(audio_bytes)
        print(f"Saved {path.name} ({len(audio_bytes)} bytes)")
    print(f"Done. Output in {output_dir}")


@app.local_entrypoint()
def test_pipeline(
    output_path: str = "/tmp/tts-output.mp3",
) -> None:
    """Test full pipeline: batch TTS + stitch (task 1.4)."""
    chunks = [
        "First chunk: Hello from the TTS web app.",
        "Second chunk: Chatterbox is running on Modal.",
        "Third chunk: Batch processing and stitching into one MP3.",
    ]
    tts = ChatterboxTTS()
    print(f"Generating {len(chunks)} chunks and stitching to MP3...")
    mp3_bytes = tts.generate_and_stitch.remote(chunks, DEFAULT_VOICE_PATH)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(mp3_bytes)
    print(f"Saved to {output_path} ({len(mp3_bytes)} bytes)")


PREVIEW_SENTENCE = "This is a short preview of this voice."

@app.local_entrypoint()
def generate_cfg_weight_sweep_for_voice(
    voice_id: str = "aba",
    text: str = PREVIEW_SENTENCE,
    cfg_weights: str = "0.25,0.5,0.75",
    exaggeration: float = 0.5,
    temperature: float = 0.8,
) -> None:
    """
    Voice-specific experimentation: generate MP3s for a cfg_weight sweep.

    Outputs to: `voices/experiments/<voice_id>-cfg-sweep/`
    """
    manifest_path = Path("voices/voices.json")
    if not manifest_path.exists():
        raise FileNotFoundError("voices/voices.json not found")

    data = json.loads(manifest_path.read_text())
    voices: list[dict] = data.get("voices", [])
    voice = next((v for v in voices if v.get("id") == voice_id), None)
    if not voice:
        raise ValueError(f"Unknown voice_id: {voice_id!r}")

    weights = [float(x.strip()) for x in cfg_weights.split(",") if x.strip()]
    if not weights:
        raise ValueError("cfg_weights must contain at least one numeric value")

    filename = voice.get("filename")
    if not filename:
        raise ValueError("Voice manifest entry missing 'filename'")

    reference_path_in_container = f"{VOICES_CUSTOM_PATH}/{filename}"

    out_dir = Path("voices") / "experiments" / f"{voice_id}-cfg-sweep"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(
        f"[cfg_sweep] voice={voice_id!r} reference={filename!r} cfg_weights={weights} exaggeration={exaggeration} temperature={temperature}",
        flush=True,
    )

    tts = ChatterboxTTS()
    mp3_by_cfg = tts.generate_cfg_sweep.remote(
        text,
        reference_path_in_container,
        weights,
        exaggeration=exaggeration,
        temperature=temperature,
    )

    safe_cfg = lambda v: str(v).replace(".", "_")
    for cfg in weights:
        key = str(cfg)
        mp3_bytes = mp3_by_cfg.get(key)
        if not mp3_bytes:
            raise RuntimeError(f"Missing sweep output for cfg_weight={key}")
        out_path = out_dir / f"cfg_weight_{safe_cfg(cfg)}.mp3"
        out_path.write_bytes(mp3_bytes)
        print(f"[cfg_sweep] wrote {out_path.name} ({len(mp3_bytes)} bytes)")

    manifest_out = out_dir / "manifest.json"
    manifest_out.write_text(
        json.dumps(
            {
                "voice_id": voice_id,
                "filename": filename,
                "text": text,
                "cfg_weights": weights,
                "exaggeration": exaggeration,
                "temperature": temperature,
            },
            indent=2,
        )
    )
    print(f"[cfg_sweep] done. See {manifest_out}")


def resolve_voice_preview_inputs(voice: Dict) -> Tuple[str, str]:
    """Given a voice manifest entry, return (reference_path_in_container, preview_filename)."""
    voice_id = str(voice.get("id") or "")
    filename = voice.get("filename")
    if not filename or not voice_id:
        raise ValueError("Voice manifest entry missing required fields: id and filename")
    preview_filename = voice.get("preview_filename") or f"{voice_id}-preview.mp3"
    reference_path_in_container = f"{VOICES_CUSTOM_PATH}/{filename}"
    return reference_path_in_container, str(preview_filename)


@app.local_entrypoint()
def generate_voice_previews() -> None:
    """
    Generate synthetic preview audio for each persona voice using a shared sentence.

    This uses the reference clip as the TTS prompt but writes per-voice preview MP3s
    under the local `voices/` directory, matching the `preview_filename` field in
    voices/voices.json.
    """
    manifest_path = Path("voices/voices.json")
    if not manifest_path.exists():
        print("voices/voices.json not found; aborting.")
        return
    data = json.loads(manifest_path.read_text())
    voices: list[dict] = data.get("voices", [])
    if not voices:
        print("No voices in manifest; nothing to do.")
        return

    tts = ChatterboxTTS()
    for v in voices:
        vid = v.get("id")
        filename = v.get("filename")
        if not vid or not filename:
            continue
        preview_filename = v.get("preview_filename") or f"{vid}-preview.mp3"
        # Path inside the GPU container where the reference clip is mounted.
        reference_path_in_container = f"{VOICES_CUSTOM_PATH}/{filename}"
        try:
            print(f"[preview] Generating preview for {vid!r} using {filename!r}...")
            mp3_bytes = tts.generate_and_stitch.remote([PREVIEW_SENTENCE], reference_path_in_container)
        except Exception as e:  # noqa: BLE001
            print(f"[preview] Failed for {vid!r}: {e!r}")
            continue
        out_path = Path("voices") / preview_filename
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(mp3_bytes)
        print(f"[preview] Saved {preview_filename} ({len(mp3_bytes)} bytes)")


@app.local_entrypoint()
def generate_voice_preview_for(voice_id: str = "aba") -> None:
    """Generate synthetic preview audio for one persona voice using the shared sentence."""
    manifest_path = Path("voices/voices.json")
    if not manifest_path.exists():
        print("voices/voices.json not found; aborting.")
        return
    data = json.loads(manifest_path.read_text())
    voices: list[dict] = data.get("voices", [])
    voice = next((v for v in voices if v.get("id") == voice_id), None)
    if not voice:
        print(f"Unknown voice_id: {voice_id!r}")
        return

    tts = ChatterboxTTS()
    reference_path_in_container, preview_filename = resolve_voice_preview_inputs(voice)
    print(
        f"[preview] Generating preview for {voice_id!r} using reference {reference_path_in_container!r}..."
    )
    mp3_bytes = tts.generate_and_stitch.remote([PREVIEW_SENTENCE], reference_path_in_container)
    out_path = Path("voices") / preview_filename
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(mp3_bytes)
    print(f"[preview] Saved {preview_filename} ({len(mp3_bytes)} bytes)")


@app.local_entrypoint()
def generate_lucy_preview() -> None:
    """Generate synthetic preview audio for Lucy (dev) using the shared sentence."""
    tts = ChatterboxTTS()
    try:
        print(f"[preview] Generating preview for 'lucy' using {DEFAULT_VOICE_PATH!r}...")
        mp3_bytes = tts.generate_and_stitch.remote([PREVIEW_SENTENCE], DEFAULT_VOICE_PATH)
    except Exception as e:  # noqa: BLE001
        print(f"[preview] Failed for 'lucy': {e!r}")
        return
    out_path = Path("voices") / "lucy-preview.mp3"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(mp3_bytes)
    print(f"[preview] Saved lucy-preview.mp3 ({len(mp3_bytes)} bytes)")

@app.local_entrypoint()
def test_progress(
    output_path: str = "/tmp/tts-output-progress.mp3",
) -> None:
    """Test progress reporting (task 1.5)."""
    chunks = [
        "First chunk: Hello from the TTS web app.",
        "Second chunk: Chatterbox is running on Modal.",
        "Third chunk: Progress updates as each chunk completes.",
    ]
    tts = ChatterboxTTS()
    print(f"Generating {len(chunks)} chunks with progress updates...")
    mp3_bytes = b""
    for update in tts.generate_and_stitch_with_progress.remote_gen(
        chunks, DEFAULT_VOICE_PATH
    ):
        print(f"  Progress: {update['progress']}% (chunk {update['chunk']}/{update['total']})")
        if "mp3" in update and update["mp3"]:
            mp3_bytes = update["mp3"]
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(mp3_bytes)
    print(f"Saved to {output_path} ({len(mp3_bytes)} bytes)")


# Sample text for full pipeline test (1,000+ words)
SAMPLE_1000_WORDS = """
The sun was setting over the quiet town, casting long shadows across the empty streets.
Sarah walked slowly toward the old library, her footsteps echoing in the stillness.
She had been coming here every Thursday for as long as she could remember.
Inside, the familiar smell of old books greeted her like an old friend.
The librarian nodded and returned to her crossword puzzle.
Sarah found her usual spot by the window and opened the novel she had been reading.
The story was about a woman who discovered she could travel through time.
Each chapter brought new twists and unexpected turns.
Sarah lost herself in the narrative, forgetting about the world outside.
Hours passed before she finally looked up from the page.
The library was almost empty now, with just a few evening visitors.
She marked her place and stood to stretch her tired legs.
Through the window, she watched the streetlights flicker on one by one.
It was time to head home, but she felt reluctant to leave.
The book had pulled her into another world entirely.
She promised herself she would return tomorrow to continue the journey.
Outside, the cool evening air felt refreshing against her skin.
She walked quickly through the growing darkness toward her apartment.
The city was waking up for the night, with restaurants and cafes filling with people.
Sarah preferred the quiet of the early evening to the busy nightlife.
At home, she made a simple dinner and sat down to eat alone.
She thought about the book and wondered what would happen next.
The characters had become real to her over the past few days.
Their struggles and triumphs felt almost like her own.
She cleaned up the kitchen and settled into her favorite chair.
The television stayed off as she picked up the book again.
Reading had always been her escape from the pressures of daily life.
Work had been particularly stressful this week, with endless meetings and deadlines.
The library was her sanctuary, a place where she could breathe.
She read until her eyes grew heavy and the words began to blur.
Finally, she closed the book and headed to bed.
Tomorrow would bring another day of challenges, but she would face them.
For now, she would rest and dream of distant lands and adventures.
The alarm rang at six o'clock, pulling her from a deep sleep.
She rolled over and blinked at the bright morning light.
Another day had begun, full of possibilities and unknown paths.
She stretched and smiled, remembering the book waiting for her.
Perhaps today would be the day she finished the story.
Or perhaps she would discover something new in its pages.
Either way, she looked forward to losing herself in another world.
The coffee machine hummed as she prepared her morning brew.
She glanced at the clock and realized she was running late.
Quickly, she threw on her clothes and grabbed her bag.
The bus arrived just as she reached the stop, a small victory.
She found a seat and opened her book for the short ride.
Twenty minutes later, she stepped off near her office building.
The day passed in a blur of emails and meetings.
At lunch, she escaped to a quiet park bench with her book.
The autumn leaves crunched beneath her feet as she walked.
She found a spot in the sun and read for the entire hour.
Returning to work, she felt refreshed and ready to continue.
The afternoon flew by, and suddenly it was five o'clock.
She packed her things and headed back to the bus stop.
This time, she went straight to the library instead of home.
The same librarian was there, and she smiled in recognition.
Sarah found her window seat and dove back into the story.
The main character was facing a critical decision.
Would she reveal her secret to the people she loved?
Or would she keep it hidden and risk losing everything?
Sarah turned the pages eagerly, desperate to know the outcome.
The author had a gift for building tension and suspense.
Each chapter ended with a cliffhanger that demanded continuation.
Sarah had never been so invested in a fictional world.
When the library closed at nine, she was only halfway through.
She checked out the book and promised to return it soon.
At home, she read until well past midnight.
The ending did not disappoint; it was satisfying and unexpected.
She closed the book with a sigh of contentment.
Some stories stayed with you long after the last page.
This one would live in her memory for years to come.
She fell asleep with a smile on her face.
The next morning, she felt a strange sense of loss.
The adventure was over, and she missed the characters already.
But she knew there were countless other books waiting.
The library held endless possibilities, and she would explore them all.
She made a list of recommendations from the librarian.
Historical fiction, science fiction, mysteries, and romance.
Each genre offered something different, a new perspective on life.
Reading had taught her empathy and understanding.
It had shown her worlds she could never visit in person.
It had given her comfort during difficult times.
For that, she would always be grateful.
The weekend arrived at last, and Sarah slept in late.
She made pancakes and sat by the window with a new book.
This one was a thriller, full of twists and surprises.
By evening, she had read half of it and could not stop.
She ordered takeout so she would not have to leave.
The delivery person found her buried in the story.
She ate distractedly, barely tasting the food.
The final chapters kept her up until three in the morning.
When she closed the book, her heart was still racing.
Some stories had that power over their readers.
She lay in bed replaying the plot in her mind.
Sleep came eventually, but the story stayed with her until dawn.
She dreamed of libraries and endless shelves of books.
In the morning, she woke with a smile, ready for the next adventure.
"""


@app.local_entrypoint()
def test_full_pipeline(
    output_path: str = "/tmp/tts-full-output.mp3",
) -> None:
    """Test full pipeline with 1,000+ word input (task 1.6)."""
    chunks = chunk_text(SAMPLE_1000_WORDS)
    word_count = len(SAMPLE_1000_WORDS.split())
    print(f"Input: {word_count} words, {len(chunks)} chunks")
    tts = ChatterboxTTS()
    print("Generating with progress...")
    mp3_bytes = b""
    for update in tts.generate_and_stitch_with_progress.remote_gen(
        chunks, DEFAULT_VOICE_PATH
    ):
        print(f"  Progress: {update['progress']}% (chunk {update['chunk']}/{update['total']})")
        if "mp3" in update and update["mp3"]:
            mp3_bytes = update["mp3"]
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(mp3_bytes)
    print(f"Saved to {output_path} ({len(mp3_bytes)} bytes)")


@app.local_entrypoint()
def test_e2e(
    api_url: str = "https://dave4534--tts-multilingual-api.modal.run",
    output_path: str = "/tmp/tts-e2e-output.mp3",
) -> None:
    """E2E test: submit text → poll status → download MP3 (task 3.15)."""
    import time
    import urllib.error
    import urllib.request

    text = "Hello from the end-to-end test. This short clip verifies the full pipeline."
    payload = json.dumps({"text": text, "voice_id": "lucy"}).encode()
    req = urllib.request.Request(
        f"{api_url}/convert",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"POST /convert failed: {e.code} {e.reason}", file=sys.stderr)
        raise SystemExit(1)
    job_id = data.get("job_id")
    if not job_id:
        print("No job_id in response", file=sys.stderr)
        raise SystemExit(1)
    print(f"Job {job_id}: polling for completion...")
    for _ in range(120):
        try:
            with urllib.request.urlopen(f"{api_url}/job/{job_id}/status", timeout=30) as r:
                status = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            print(f"GET status failed: {e.code}", file=sys.stderr)
            raise SystemExit(1)
        state = status.get("state", "")
        progress = status.get("progress", 0)
        if state == "complete":
            print(f"Complete ({progress}%)")
            break
        if state == "failed":
            print(f"Job failed: {status.get('error', 'unknown')}", file=sys.stderr)
            raise SystemExit(1)
        print(f"  {state} {progress}%")
        time.sleep(2)
    else:
        print("Timeout waiting for completion", file=sys.stderr)
        raise SystemExit(1)
    try:
        with urllib.request.urlopen(f"{api_url}/job/{job_id}/download", timeout=60) as r:
            mp3 = r.read()
    except urllib.error.HTTPError as e:
        print(f"GET download failed: {e.code}", file=sys.stderr)
        raise SystemExit(1)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(mp3)
    print(f"Saved to {output_path} ({len(mp3)} bytes)")


@app.local_entrypoint()
def test_voice(
    voice_path: str = "",
    voice_id: str = "",
    output_path: str = "/tmp/tts-voice-test.wav",
) -> None:
    """Test a voice clip with Modal worker (task 2.6). Uses Lucy by default."""
    if voice_path:
        path = voice_path
    elif voice_id:
        manifest = json.loads(Path("voices/voices.json").read_text())
        voice = next((v for v in manifest["voices"] if v["id"] == voice_id), None)
        if not voice:
            print(f"Error: voice id '{voice_id}' not found in voices.json", file=sys.stderr)
            raise SystemExit(1)
        path = f"{VOICES_CUSTOM_PATH}/{voice['filename']}"
        if not Path(f"voices/{voice['filename']}").exists():
            print(f"Error: voices/{voice['filename']} not found. Add the clip first.", file=sys.stderr)
            raise SystemExit(1)
    else:
        path = DEFAULT_VOICE_PATH

    prompt = "This is a quick test of the voice. Does it sound clear and natural?"
    tts = ChatterboxTTS()
    print(f"Testing voice: {path}")
    audio_bytes = tts.generate.remote(prompt, path)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(audio_bytes)
    print(f"Saved to {output_path} ({len(audio_bytes)} bytes)")
