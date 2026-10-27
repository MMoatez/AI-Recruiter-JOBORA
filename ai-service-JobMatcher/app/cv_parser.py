"""Local CV parsing: PDF text extraction, normalization and contact redaction.

Nothing in this module calls the external AI provider. Contact details are
removed here before any text leaves the service.
"""

from __future__ import annotations

import io
import re

import pdfplumber

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# Phone numbers: 9-15 digits with separators, e.g. +33 6 12 34 56 78, 06.12.34.56.78,
# (555) 123-4567. Four-digit year ranges such as 2020-2023 never match (8 digits max).
PHONE_RE = re.compile(r"(?<!\d)\+?\d(?:[\s.\-()]*\d){8,14}(?!\d)")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
HYPHEN_BREAK_RE = re.compile(r"(\w)-\n(\w)")
MULTI_SPACE_RE = re.compile(r"[ \t]+")
MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


class CvParseError(Exception):
    """The uploaded file could not be read as a CV."""


def extract_text(data: bytes, *, max_chars: int = 30000, min_chars: int = 20) -> str:
    """Extract readable text from a PDF byte payload and validate it."""
    if not data:
        raise CvParseError("The uploaded file is empty.")
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
    except Exception as error:  # pdfplumber raises many parser-specific errors
        raise CvParseError("The file could not be read as a PDF document.") from error
    text = normalize_text("\n".join(pages))
    if len(text) < min_chars:
        raise CvParseError("The PDF does not contain enough readable text.")
    return text[:max_chars]


def normalize_text(text: str) -> str:
    """Collapse whitespace and drop formatting artifacts without changing meaning."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = CONTROL_CHARS_RE.sub(" ", text)
    text = HYPHEN_BREAK_RE.sub(r"\1\2", text)
    lines = [MULTI_SPACE_RE.sub(" ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


def redact_contact(text: str) -> str:
    """Remove contact details before text is sent to the external AI provider."""
    text = EMAIL_RE.sub("[EMAIL]", text)
    text = PHONE_RE.sub("[PHONE]", text)
    return text
