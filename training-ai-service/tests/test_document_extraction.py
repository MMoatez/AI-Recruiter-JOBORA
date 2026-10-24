from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient

from app.document_extraction import DocumentExtractionError, extract_document
from app.main import app


def test_extracts_utf8_text_document():
    text, truncated = extract_document("cv.txt", b"Python developer with Docker and Git project experience.")
    assert "Docker" in text
    assert truncated is False


def test_extracts_docx_document():
    document = Document()
    document.add_paragraph("Flutter developer with Firebase project experience.")
    content = BytesIO()
    document.save(content)
    text, truncated = extract_document("resume.docx", content.getvalue())
    assert "Firebase" in text
    assert truncated is False


def test_rejects_unsupported_and_empty_documents():
    try:
        extract_document("cv.exe", b"not a document")
        assert False
    except DocumentExtractionError:
        pass
    try:
        extract_document("cv.txt", b"")
        assert False
    except DocumentExtractionError:
        pass


def test_document_upload_endpoint_does_not_persist_file():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/training/documents/extract",
            files={"file": ("offer.txt", b"Role requires React, TypeScript, Docker and CI/CD experience.", "text/plain")},
        )
    assert response.status_code == 200
    assert response.json()["filename"] == "offer.txt"
    assert "TypeScript" in response.json()["text"]
