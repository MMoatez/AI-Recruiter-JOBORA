from __future__ import annotations

import pytest

from app.cv_parser import CvParseError, extract_text, normalize_text, redact_contact

from .conftest import build_pdf


def test_extracts_text_from_valid_pdf() -> None:
    pdf = build_pdf("Python FastAPI developer with Docker experience")
    text = extract_text(pdf)
    assert "Python" in text
    assert "FastAPI" in text
    assert len(text) >= 20


def test_rejects_garbage_bytes() -> None:
    with pytest.raises(CvParseError):
        extract_text(b"this is not a pdf at all")


def test_rejects_empty_file() -> None:
    with pytest.raises(CvParseError):
        extract_text(b"")


def test_rejects_pdf_without_readable_text() -> None:
    pdf = build_pdf("hi")
    with pytest.raises(CvParseError):
        extract_text(pdf, min_chars=20)


def test_normalize_collapses_artifacts() -> None:
    raw = "Line one  \t with   spaces\r\n\n\n\nNext\x00line\nband-\nwidth done"
    normalized = normalize_text(raw)
    assert "  " not in normalized.replace("\n\n", "")
    assert "\x00" not in normalized
    assert "bandwidth" in normalized  # hyphen line-break removed
    assert "\n\n\n" not in normalized


def test_redact_contact_removes_email_and_phone_keeps_year_ranges() -> None:
    text = "Contact: jean.dupont@example.com / +33 6 12 34 56 78\nExperience 2020-2023 at ACME"
    redacted = redact_contact(text)
    assert "jean.dupont@example.com" not in redacted
    assert "6 12 34 56 78" not in redacted
    assert "[EMAIL]" in redacted
    assert "[PHONE]" in redacted
    assert "2020-2023" in redacted  # year ranges are not phone numbers
