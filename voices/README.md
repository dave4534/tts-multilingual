# Voice Reference Clips

Store 6–10 second reference audio clips here for each voice persona.

**Extract clips from source audio:**
```bash
pip install pydub   # and ffmpeg on PATH
python voices/extract_clip.py input.mp3 output.wav --start 30 --duration 8
```

**Normalize volume across clips (Task 2.3):**
```bash
python voices/normalize_clips.py clip1.wav clip2.wav --target -3
python voices/normalize_clips.py voices/*.wav --out-dir voices/normalized
```

**MVP lineup and filenames (Task 2.4):**

| Persona | Filename |
|---------|----------|
| Calm older man | `calm-older-man.wav` |
| Upbeat young woman | `upbeat-young-woman.wav` |
| Professional man | `professional-man.wav` |
| Professional woman | `professional-woman.wav` |
| Gentle young man | `gentle-young-man.wav` |
| Warm older woman | `warm-older-woman.wav` |

Store normalized WAV files in this directory. See `voices.json` for the manifest (Task 2.5).

**Test each voice with Modal (Task 2.6):**
```bash
modal run modal_app/main.py::test_voice                    # test Lucy (sample)
modal run modal_app/main.py::test_voice --voice-id calm-older-man   # test custom clip
```

**Format:** WAV, normalized volume (use `normalize_clips.py`).
**Source:** LibriVox, Mozilla Common Voice (open-licensed).
