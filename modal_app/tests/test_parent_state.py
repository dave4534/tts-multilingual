from modal_app import main as backend


def _make_section(state: str, progress: int, error=None) -> dict:
    return {"state": state, "progress": progress, "error": error}


def test_summarize_parent_state_all_complete() -> None:
    parent = {"state": "queued", "progress": 0, "error": None}
    sections = [
        _make_section("complete", 100),
        _make_section("complete", 100),
    ]
    summary = backend.summarize_parent_state(parent, sections)
    assert summary["state"] == "complete"
    assert summary["progress"] == 100
    assert summary["error"] is None


def test_summarize_parent_state_processing_mixed_progress() -> None:
    parent = {"state": "queued", "progress": 0, "error": None}
    sections = [
        _make_section("complete", 100),
        _make_section("processing", 40),
        _make_section("queued", 0),
    ]
    summary = backend.summarize_parent_state(parent, sections)
    assert summary["state"] == "processing"
    # (100 + 40 + 0) / 3 ≈ 46
    assert summary["progress"] == int((100 + 40 + 0) / 3)
    assert summary["error"] is None


def test_summarize_parent_state_failed_uses_first_error() -> None:
    parent = {"state": "queued", "progress": 0, "error": None}
    sections = [
        _make_section("failed", 20, "first error"),
        _make_section("processing", 10, "second error"),
    ]
    summary = backend.summarize_parent_state(parent, sections)
    assert summary["state"] == "failed"
    assert summary["error"] == "first error"


