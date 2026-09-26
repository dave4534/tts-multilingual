"""Tests for completed-job MP3 cleanup (no separate Modal Dict)."""

from modal_app.main import cleanup_stale_job_mp3s


def test_cleanup_drops_stale_mp3() -> None:
    store = {
        "job-1": {
            "state": "complete",
            "mp3": b"audio",
            "completed_at": 100.0,
        },
    }
    cleanup_stale_job_mp3s(store, cutoff=200.0, now=500.0)
    assert store["job-1"]["mp3"] is None
    assert store["job-1"]["completed_at"] == 100.0


def test_cleanup_keeps_recent_mp3() -> None:
    store = {
        "job-1": {
            "state": "complete",
            "mp3": b"audio",
            "completed_at": 400.0,
        },
    }
    cleanup_stale_job_mp3s(store, cutoff=200.0, now=500.0)
    assert store["job-1"]["mp3"] == b"audio"


def test_cleanup_stamps_legacy_completed_jobs() -> None:
    store = {
        "job-1": {
            "state": "complete",
            "mp3": b"audio",
        },
    }
    cleanup_stale_job_mp3s(store, cutoff=200.0, now=500.0)
    assert store["job-1"]["mp3"] == b"audio"
    assert store["job-1"]["completed_at"] == 500.0


def test_cleanup_ignores_non_complete_or_empty_mp3() -> None:
    store = {
        "a": {"state": "processing", "mp3": b"x", "completed_at": 0.0},
        "b": {"state": "complete", "mp3": None, "completed_at": 0.0},
    }
    cleanup_stale_job_mp3s(store, cutoff=999.0, now=1000.0)
    assert store["a"]["mp3"] == b"x"
    assert store["b"]["mp3"] is None
