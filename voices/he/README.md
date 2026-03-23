# Hebrew reference voices

Drop **6–10 second** Hebrew reference clips (WAV) here, then register them in **`../voices.json`** with:

- `"filename": "he/your-clip.wav"` (path relative to the `voices/` root)
- `"language_ids": ["he"]` (add `"en"` too if the same clip should appear for English)

Optional: **`preview_filename`** (e.g. `he/your-voice-preview.mp3`) plus **`preview_text`** for Hebrew copy; generate the MP3 with `modal run modal_app/main.py::generate_voice_preview_for --voice-id <id>`.

After updating the manifest, redeploy Modal (`modal deploy modal_app/main.py`) so the file is mounted in the container.
