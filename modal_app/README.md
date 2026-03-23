# Modal TTS Backend

## Setup

Create a HuggingFace token secret in Modal (required for Chatterbox model):

```bash
python3 -m modal secret create hf-token HUGGING_FACE_HUB_TOKEN='<your-hf-token>'
```
Use `HUGGING_FACE_HUB_TOKEN` (Hugging Face Hub expects this key).

Get a token at https://huggingface.co/settings/tokens (read access is enough).

## Run

```bash
# Test single-chunk generation (task 1.2)
python3 -m modal run modal_app/main.py
# Or with custom prompt:
python3 -m modal run modal_app/main.py --prompt "Your text here" --output-path /tmp/out.wav
```
