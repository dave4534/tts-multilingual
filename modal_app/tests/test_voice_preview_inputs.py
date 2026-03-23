from modal_app import main as backend


def test_resolve_voice_preview_inputs_uses_manifest_fields() -> None:
    voice = {
        "id": "aba",
        "filename": "Aba.wav",
        "preview_filename": "aba-preview.mp3",
    }
    reference_path, preview_filename = backend.resolve_voice_preview_inputs(voice)
    assert reference_path == f"{backend.VOICES_CUSTOM_PATH}/Aba.wav"
    assert preview_filename == "aba-preview.mp3"


def test_resolve_voice_preview_inputs_default_preview_filename() -> None:
    voice = {
        "id": "aba",
        "filename": "Aba.wav",
    }
    reference_path, preview_filename = backend.resolve_voice_preview_inputs(voice)
    assert reference_path == f"{backend.VOICES_CUSTOM_PATH}/Aba.wav"
    assert preview_filename == "aba-preview.mp3"

