from __future__ import annotations

from io import BytesIO
from pathlib import Path

from docx import Document
from pypdf import PdfReader


MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARACTERS = 30_000
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


class DocumentExtractionError(ValueError):
    pass


def extract_document(filename: str, content: bytes) -> tuple[str, bool]:
    extension = Path(filename).suffix.casefold()
    if extension not in SUPPORTED_EXTENSIONS:
        raise DocumentExtractionError("Only PDF, DOCX, and TXT files are supported.")
    if not content:
        raise DocumentExtractionError("The uploaded document is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise DocumentExtractionError("The document exceeds the 8 MB limit.")
    try:
        if extension == ".pdf":
            text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages)
        elif extension == ".docx":
            document = Document(BytesIO(content))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        else:
            text = content.decode("utf-8-sig")
    except (OSError, UnicodeError, ValueError) as error:
        raise DocumentExtractionError("The document could not be read.") from error
    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if len(text) < 20:
        raise DocumentExtractionError("Not enough readable text was found in the document.")
    truncated = len(text) > MAX_TEXT_CHARACTERS
    return text[:MAX_TEXT_CHARACTERS], truncated
