# Voice Reference Clips

Audio assets live under **language subfolders** (paths match `voices.json`):

| Folder | Purpose |
|--------|---------|
| **`en/`** | English reference WAVs and preview MP3s |
| **`he/`** | Hebrew reference WAVs (and previews when added) |

Manifest entries use paths **relative to this directory**, e.g. `"filename": "en/Dave.wav"`, `"preview_filename": "en/dave-preview.mp3"`.

---

**Extract clips from source audio:**
```bash
pip install pydub   # and ffmpeg on PATH
python voices/extract_clip.py input.mp3 voices/en/output.wav --start 30 --duration 8
```

**Normalize volume across clips (Task 2.3):**
```bash
python voices/normalize_clips.py voices/en/clip1.wav voices/en/clip2.wav --target -3
python voices/normalize_clips.py voices/en/*.wav --out-dir voices/en/normalized
```

**MVP lineup (English)** — files under `en/`:

| Persona | Filename (under `en/`) |
|---------|-------------------------|
| Professional man | `professional-man.wav` |
| Professional woman | `professional-woman.wav` |
| … | See `voices.json` |

**Hebrew:** add WAVs under `he/` and register in `voices.json` with `"filename": "he/yourfile.wav"` and `"language_ids": ["he"]`. See `he/README.md`.

**Test each voice with Modal (Task 2.6):**
```bash
modal run modal_app/main.py::test_voice                    # test Lucy (sample)
modal run modal_app/main.py::test_voice --voice-id dave   # test custom clip
```

**Format:** WAV, normalized volume (use `normalize_clips.py`).
**Source:** LibriVox, Mozilla Common Voice (open-licensed).
