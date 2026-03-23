"""Tests for Chatterbox Multilingual language_id validation."""

import pytest

from modal_app import main as backend


def test_normalize_language_id_accepts_uppercase() -> None:
    assert backend.normalize_language_id("EN") == "en"


def test_normalize_language_id_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="Unsupported language_id"):
        backend.normalize_language_id("xx")
