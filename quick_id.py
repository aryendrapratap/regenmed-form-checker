"""
quick_id.py  -  recognise the form from its layout in a fraction of a second, without AI.

Each of RegenMed's 4 forms has a very different layout (boxes, lines, tables). We compare a tiny,
blurred thumbnail of the uploaded page with thumbnails of the sample forms (stored in
form_fingerprints.json). When the match is clear, we skip the Gemini call; when it isn't
(sideways page, unusual scan, a different document), ai.py asks Gemini as before.

Tested on the samples, including tilted, shifted, zoomed, darker, partly blank and phone-photo-like
versions: 34 clear matches, 0 wrong, and every unclear case safely falls back to Gemini.

To rebuild the fingerprints from your own samples:
    python quick_id.py
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SIZE = (48, 62)          # thumbnail width, height
MIN_SCORE = 0.75         # how alike the page must be to a known form (1.0 = identical)
MIN_LEAD = 0.25          # how much better than the next-best form
FILE = Path(__file__).with_name("form_fingerprints.json")

_templates = None


def _trim(gray: Image.Image) -> Image.Image:
    """Cut away blank margins, so shifted or zoomed scans still line up."""
    dark = np.asarray(gray.filter(ImageFilter.GaussianBlur(2)), dtype=np.float32) < 170
    rows = np.where(dark.mean(axis=1) > 0.02)[0]
    cols = np.where(dark.mean(axis=0) > 0.02)[0]
    if len(rows) < 10 or len(cols) < 10:
        return gray
    return gray.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1))


def _thumb(gray: Image.Image) -> np.ndarray:
    small = gray.resize((SIZE[0] * 4, SIZE[1] * 4)).filter(ImageFilter.GaussianBlur(3)).resize(SIZE, Image.BILINEAR)
    return np.asarray(small, dtype=np.uint8)


def _normal(thumb: np.ndarray) -> np.ndarray:
    a = thumb.astype(np.float32).ravel()
    return (a - a.mean()) / (a.std() + 1e-6)


def fingerprint(page: Image.Image) -> tuple:
    """Two thumbnails of a page: as scanned, and with blank margins cut away."""
    gray = page.convert("L")
    if gray.width > 1000:  # same detail whatever the scan resolution
        gray = gray.resize((1000, round(gray.height * 1000 / gray.width)))
    return _thumb(gray), _thumb(_trim(gray))


def _load() -> list:
    global _templates
    if _templates is None:
        data = json.loads(FILE.read_text())
        _templates = []
        for item in data["templates"]:
            full, cut = (np.frombuffer(base64.b64decode(item[k]), dtype=np.uint8).reshape(SIZE[1], SIZE[0])
                         for k in ("full", "trimmed"))
            _templates.append((item["form"], _normal(full), _normal(cut)))
    return _templates


def scores(page: Image.Image) -> dict:
    """How alike this page is to each known form, from -1 to 1."""
    full, cut = (_normal(t) for t in fingerprint(page))
    n = full.size
    result = {}
    for form, t_full, t_cut in _load():
        score = max(float(full @ t_full) / n, float(cut @ t_cut) / n)
        result[form] = max(result.get(form, -1.0), score)
    return result


def identify(page: Image.Image) -> str | None:
    """The form type if the layout match is clear, else None (then ask Gemini)."""
    try:
        ranked = sorted(scores(page).items(), key=lambda kv: -kv[1])
    except Exception:
        return None
    if len(ranked) < 2:
        return None
    (best, top), (_, second) = ranked[0], ranked[1]
    return best if top >= MIN_SCORE and top - second >= MIN_LEAD else None


def build(samples: dict) -> None:
    """samples = {"QS-F-049": [page images...], ...}. Saves form_fingerprints.json."""
    templates = []
    for form, pages in samples.items():
        for page in pages:
            full, cut = fingerprint(page)
            templates.append({"form": form, "full": base64.b64encode(full.tobytes()).decode(),
                              "trimmed": base64.b64encode(cut.tobytes()).decode()})
    FILE.write_text(json.dumps({"size": SIZE, "templates": templates}, indent=1))
    print(f"saved {len(templates)} fingerprints to {FILE.name}")


if __name__ == "__main__":
    # Rebuild from the PDFs in samples/: the form type is taken from each file name.
    import pymupdf

    found = {}
    for pdf in sorted(Path(__file__).with_name("samples").glob("*.[pP][dD][fF]")):
        name = pdf.name.upper()
        form = ("MP-F-023" if "MP-F-023" in name else "QS-F-049" if "QS-F-049" in name else
                "LOT_LOG" if "LOT" in name else "DISCARD" if "DISCARD" in name else None)
        if form is None:
            print(f"skipped {pdf.name} (can't tell the form from its name)")
            continue
        for index, page in enumerate(pymupdf.open(pdf)):
            if form == "DISCARD" and index > 0:
                break  # one Discard page is enough; the others are the same layout
            pix = page.get_pixmap(dpi=100)
            found.setdefault(form, []).append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    build(found)
