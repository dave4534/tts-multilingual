"""Tests for speech-to-text helpers (POST /transcribe, GET /transcribe/{id}/result)."""

import pytest

from modal_app.main import (
    cleanup_stale_transcripts,
    decode_audio_to_float32,
    format_srt_time,
    normalize_transcription_language,
    segments_to_srt,
    segments_to_text,
    transcript_content_disposition,
    validate_transcription_upload,
)


def test_format_srt_time_handles_hours_and_millis() -> None:
    assert format_srt_time(0) == "00:00:00,000"
    assert format_srt_time(1.5) == "00:00:01,500"
    assert format_srt_time(3661.042) == "01:01:01,042"


def test_segments_to_srt_numbers_blocks_and_skips_blank_text() -> None:
    segments = [
        {"start": 0.0, "end": 2.5, "text": " שלום עולם "},
        {"start": 2.5, "end": 3.0, "text": "   "},
        {"start": 3.0, "end": 5.0, "text": "Second line"},
    ]
    srt = segments_to_srt(segments)
    assert srt == (
        "1\n00:00:00,000 --> 00:00:02,500\nשלום עולם\n"
        "\n"
        "2\n00:00:03,000 --> 00:00:05,000\nSecond line\n"
    )


def test_segments_to_srt_empty_input_returns_empty_string() -> None:
    assert segments_to_srt([]) == ""


def test_segments_to_text_joins_non_empty_lines() -> None:
    segments = [
        {"start": 0.0, "end": 1.0, "text": "one"},
        {"start": 1.0, "end": 2.0, "text": " "},
        {"start": 2.0, "end": 3.0, "text": "two"},
    ]
    assert segments_to_text(segments) == "one\ntwo"


@pytest.mark.parametrize("name", ["talk.mp3", "TALK.WAV", "memo.m4a"])
def test_validate_accepts_supported_audio(name: str) -> None:
    validate_transcription_upload(name, 1024)


def test_validate_rejects_unsupported_extension() -> None:
    with pytest.raises(ValueError, match="mp3, .wav, or .m4a"):
        validate_transcription_upload("doc.pdf", 1024)


def test_validate_rejects_oversized_audio() -> None:
    too_big = 100 * 1024 * 1024 + 1
    with pytest.raises(ValueError, match="exceeds 100 MB"):
        validate_transcription_upload("long.mp3", too_big)


def test_normalize_language_defaults_to_hebrew() -> None:
    assert normalize_transcription_language(None) == "he"
    assert normalize_transcription_language(" EN ") == "en"


def test_normalize_language_rejects_unknown_code() -> None:
    with pytest.raises(ValueError):
        normalize_transcription_language("fr")


def test_content_disposition_is_latin1_safe_for_hebrew_names() -> None:
    header = transcript_content_disposition("אורנה בשיחה.mp3", "srt")
    header.encode("latin-1")  # must not raise
    assert "filename=\"transcript.srt\"" in header
    assert "filename*=UTF-8''" in header


def test_content_disposition_keeps_ascii_name() -> None:
    header = transcript_content_disposition("talk.mp3", "txt")
    assert header == "attachment; filename=\"talk.txt\"; filename*=UTF-8''talk.txt"


def test_decode_rejects_non_audio_bytes() -> None:
    with pytest.raises(ValueError, match="couldn't read this audio"):
        decode_audio_to_float32(b"this is not audio at all")


def test_cleanup_removes_only_old_finished_transcripts() -> None:
    store = {
        "old_done": {"kind": "transcribe", "state": "complete", "completed_at": 100.0},
        "new_done": {"kind": "transcribe", "state": "complete", "completed_at": 500.0},
        "old_failed": {"kind": "transcribe", "state": "failed", "completed_at": 50.0},
        "running": {"kind": "transcribe", "state": "processing"},
        "tts_job": {"state": "complete", "completed_at": 10.0},
    }
    cleanup_stale_transcripts(store, cutoff=200.0)
    assert set(store) == {"new_done", "running", "tts_job"}
