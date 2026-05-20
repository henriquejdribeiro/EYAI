from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader


def extract_text_from_pdf_bytes(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p.strip() for p in pages if p.strip())


def extract_text_from_pdf_path(path: Path) -> str:
    return extract_text_from_pdf_bytes(path.read_bytes())
