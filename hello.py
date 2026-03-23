"""Minimal Modal hello-world to verify authentication."""

import modal

app = modal.App("tts-hello")


@app.function()
def hello() -> str:
    return "Hello from Modal!"


@app.local_entrypoint()
def main() -> None:
    result = hello.remote()
    print(result)
