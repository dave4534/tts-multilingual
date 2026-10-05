# Multilingual Text to Speech

Paste text or upload a document and get natural-sounding audio in 23 languages, including Hebrew.

**Live demo:** https://tts-multilingual.vercel.app

## Why I built it

Most text-to-speech tools handle English well and Hebrew poorly. I wanted a simple, well-designed tool that reads long documents aloud in a chosen voice, in either language, without a sign-up. I designed the interface and built it end to end with AI-assisted coding as a designer-engineer project.

## What it does

- Reads text in 23 languages, with voices filtered by the selected language
- Accepts pasted text or uploaded `.txt`, `.md` and `.pdf` files (up to 10 MB, 20,000 words)
- Splits long documents into sections and shows progress while they are processed
- Previews a voice before converting
- Plays the result in the browser and lets you download it
- Adds Hebrew vocalization (niqqud) before synthesis, so Hebrew is pronounced correctly
- Light and dark mode

## How it works

| Layer | Tools |
|---|---|
| Frontend | React, Vite, Tailwind CSS, shadcn/ui, deployed on Vercel |
| Backend | FastAPI on Modal (GPU), job queue in a Modal Dict |
| Speech | Chatterbox Multilingual |
| Hebrew preprocessing | Dicta ONNX vocalization model |
| Documents and audio | PyMuPDF for PDF text, pydub to stitch sections into MP3 |

## Credits

Speech synthesis by [Chatterbox](https://github.com/resemble-ai/chatterbox). Hebrew vocalization by Dicta.
