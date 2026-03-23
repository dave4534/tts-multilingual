import types

from modal_app import main as backend


class DummyDict(dict):
    """In-memory stand-in for Modal Dict with .get/.__setitem__."""

    def get(self, key, default=None):
        return super().get(key, default)


def test_run_section_pipeline_happy_path(monkeypatch):
    section_id = "parent-1:section:0"
    text = "This is a short test section."
    voice_id = "lucy"

    store = DummyDict()
    store[section_id] = {
        "id": section_id,
        "kind": "section",
        "parent_id": "parent-1",
        "index": 0,
        "text": text,
        "voice_id": voice_id,
        "state": "queued",
        "progress": 0,
        "error": None,
        "mp3": None,
    }

    fake_updates = [
        {"progress": 50, "chunk": 1, "total": 2},
        {"progress": 100, "chunk": 2, "total": 2, "mp3": b"fake-mp3"},
    ]

    # Patch backend globals to avoid Modal/Chatterbox
    monkeypatch.setattr(backend, "job_store", store)
    monkeypatch.setattr(backend, "_resolve_voice_path", lambda v: "/tmp/voice.wav")
    # Fake TTS object with .generate_and_stitch_with_progress.remote_gen(...)
    fake_method = types.SimpleNamespace(
        remote_gen=lambda chunks, voice_path: list(fake_updates)
    )
    monkeypatch.setattr(
        backend,
        "ChatterboxTTS",
        lambda: types.SimpleNamespace(
            generate_and_stitch_with_progress=fake_method,
        ),
    )
    # completed_jobs bookkeeping is used but not critical for state
    monkeypatch.setattr(
        backend,
        "completed_jobs",
        {"_completed": []},
    )

    # run_section_pipeline is a Modal function; invoke via .local for tests
    backend.run_section_pipeline.local(section_id)

    job = store[section_id]
    assert job["state"] == "complete"
    assert job["progress"] == 100
    assert job["mp3"] == b"fake-mp3"


def test_run_section_pipeline_passes_condition_params(monkeypatch):
    section_id = "parent-2:section:0"
    text = "This is a short test section."
    voice_id = "lucy"

    store = DummyDict()
    store[section_id] = {
        "id": section_id,
        "kind": "section",
        "parent_id": "parent-2",
        "index": 0,
        "text": text,
        "voice_id": voice_id,
        "state": "queued",
        "progress": 0,
        "error": None,
        "mp3": None,
        "cfg_weight": 0.9,
        "exaggeration": 0.7,
        "temperature": 0.6,
    }

    fake_updates = [
        {"progress": 50, "chunk": 1, "total": 2},
        {"progress": 100, "chunk": 2, "total": 2, "mp3": b"fake-mp3"},
    ]

    called = {}

    monkeypatch.setattr(backend, "job_store", store)
    monkeypatch.setattr(backend, "_resolve_voice_path", lambda v: "/tmp/voice.wav")

    def remote_gen(chunks, voice_path, cfg_weight=None, exaggeration=None, temperature=None):
        called.update(
            {
                "cfg_weight": cfg_weight,
                "exaggeration": exaggeration,
                "temperature": temperature,
            }
        )
        return list(fake_updates)

    fake_method = types.SimpleNamespace(remote_gen=remote_gen)
    monkeypatch.setattr(
        backend,
        "ChatterboxTTS",
        lambda: types.SimpleNamespace(
            generate_and_stitch_with_progress=fake_method,
        ),
    )

    monkeypatch.setattr(
        backend,
        "completed_jobs",
        {"_completed": []},
    )

    backend.run_section_pipeline.local(section_id)

    job = store[section_id]
    assert job["state"] == "complete"
    assert job["mp3"] == b"fake-mp3"
    assert called["cfg_weight"] == 0.9
    assert called["exaggeration"] == 0.7
    assert called["temperature"] == 0.6


