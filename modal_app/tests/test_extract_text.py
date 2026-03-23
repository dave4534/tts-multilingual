"""Tests for extract_text_from_bytes (used by POST /extract-text)."""

import pytest

from modal_app.main import extract_text_from_bytes


def test_extract_txt_returns_content() -> None:
    content = b"Hello world.\nLine two."
    result = extract_text_from_bytes(content, "doc.txt")
    assert result == "Hello world.\nLine two."


def test_extract_txt_handles_utf8() -> None:
    content = "Café résumé".encode("utf-8")
    result = extract_text_from_bytes(content, "file.txt")
    assert result == "Café résumé"


def test_extract_rejects_oversized_file() -> None:
    max_bytes = 10 * 1024 * 1024 + 1
    content = b"x" * max_bytes
    with pytest.raises(ValueError, match="exceeds 10 MB"):
        extract_text_from_bytes(content, "big.txt")


def test_extract_accepts_file_under_limit() -> None:
    content = b"Short file under limit."
    result = extract_text_from_bytes(content, "small.txt")
    assert result == "Short file under limit."


def test_extract_rejects_unsupported_format() -> None:
    with pytest.raises(ValueError, match="Please upload a .txt or .pdf file"):
        extract_text_from_bytes(b"content", "file.docx")
