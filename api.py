"""
api.py  -  the same checker as app.py, as a web API for a React (or any) frontend.

Run it on your laptop:
    uvicorn api:app --reload --port 8000
Then open http://localhost:8000/docs to try it in the browser.

Online (e.g. Render):
    Build command:  pip install -r requirements.txt
    Start command:  uvicorn api:app --host 0.0.0.0 --port $PORT
    Environment variables: GEMINI_API_KEY, HACKATHON_API_KEY (and any optional settings from secrets.toml.example)

Endpoints:
    GET  /api/health          -> {"ok": true}
    POST /api/check           -> send one PDF (form field "file"); returns the result (see below)
    POST /api/note            -> send {"form_type": ..., "problems": [...]}; returns {"note": "..."}
"""

from __future__ import annotations

import base64
import hashlib
import io
import os
import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai
import rules

MAX_MB = 20

app = FastAPI(title="RegenMed Form Checker API")

# Which websites may call this API. "*" = any (fine for the hackathon).
# To lock it down, set ALLOWED_ORIGINS="https://your-react-site.vercel.app"
origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

_cache: dict = {}  # same PDF uploaded twice -> instant answer, no Gemini calls


def _page_jpeg(page, width: int = 1000) -> str:
    """A page picture for the frontend to show, as a data URL (small enough to send quickly)."""
    img = page.convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/check")
async def check(file: UploadFile = File(...)):
    """
    Returns:
    {
      "form_type": "QS-F-049" | "MP-F-023" | "LOT_LOG" | "DISCARD" | "UNKNOWN",
      "form_name": "QS-F-049 · Technical/Quality Review and Disposition Statement",
      "passed": true,                      # no errors (please-checks and extra notes allowed)
      "counts": {"errors": 0, "please_check": 0, "extra_notes": 0},
      "problems": [ {page, section, row, row_number, field, kind, message, rule}, ... ],
      "pages": ["data:image/jpeg;base64,...", ...],   # page pictures, in order
      "per_page": [ {"page": 1, "errors": 0, "please_check": 0}, ... ],   # useful for multi-page Discard PDFs
      "seconds": 21.4
    }
    kind is "missing", "wrong_format", "inconsistent" (errors), "please_check" or "extra_note".
    """
    data = await file.read()
    if not data:
        raise HTTPException(400, "The file is empty.")
    if len(data) > MAX_MB * 1024 * 1024:
        raise HTTPException(413, f"The file is bigger than {MAX_MB} MB.")

    key = hashlib.sha256(data).hexdigest()
    if key in _cache:
        return _cache[key]

    started = time.time()
    try:
        pages = rules.pdf_to_pages(data)
    except ValueError as error:
        raise HTTPException(400, str(error))

    try:
        form_type = ai.identify_form(pages)
        if form_type == "UNKNOWN":
            problems = []
        else:
            reading = ai.read_form(pages, form_type)
            problems = rules.check_form(form_type, reading)
    except ai.GeminiError:
        raise HTTPException(503, "The AI service didn't answer. Please try again in a minute.")

    counts = rules.count(problems)
    result = {
        "form_type": form_type,
        "form_name": ai.FORM_NAMES.get(form_type, "Not one of the 4 RegenMed forms"),
        "passed": form_type != "UNKNOWN" and counts["errors"] == 0,
        "counts": counts,
        "problems": problems,
        "pages": [_page_jpeg(p) for p in pages],
        "per_page": [{"page": n,
                      "errors": sum(p["page"] == n and p["kind"] in rules.ERROR_KINDS for p in problems),
                      "please_check": sum(p["page"] == n and p["kind"] == "please_check" for p in problems)}
                     for n in range(1, len(pages) + 1)],
        "seconds": round(time.time() - started, 1),
    }
    if len(_cache) > 50:
        _cache.clear()
    _cache[key] = result
    return result


class NoteRequest(BaseModel):
    form_type: str
    problems: list


@app.post("/api/note")
def note(request: NoteRequest):
    """A short correction note for staff, written by AI (organizers' key first, then Google)."""
    return {"note": ai.correction_note(request.form_type, request.problems)}
