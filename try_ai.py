"""
try_ai.py  -  test Person 1's ai.py on real PDFs.

    python try_ai.py path/to/form.pdf [more.pdf ...]

For each PDF it prints the form type and what Gemini read, and saves the
reading as <name>_reading.json. Give those files to Person 2: they are real
test data for rules.py.

Add --note to also test correction_note with a made-up problem.
"""

import json
import sys
import time
from pathlib import Path

import pymupdf  # pip install pymupdf
from PIL import Image

import ai


def pdf_to_pages(path, dpi=200):
    """Same idea as Person 2's rules.pdf_to_pages: one upright picture per page."""
    pages = []
    for page in pymupdf.open(path):
        pix = page.get_pixmap(dpi=dpi)
        pages.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    return pages


def main(paths, want_note=False):
    for path in paths:
        print("=" * 70)
        print(path)
        start = time.time()
        ai.TIMINGS.clear()
        pages = pdf_to_pages(path)
        print(f"pages: {len(pages)}")

        form_type = ai.identify_form(pages)
        print(f"form type: {form_type}   ({time.time() - start:.1f}s)")
        if form_type == "UNKNOWN":
            continue

        data = ai.read_form(pages, form_type)
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"\nunsure boxes: {len(data['unsure'])}")
        for u in data["unsure"]:
            print(f"  page {u['page']} | {u['section']} | {u['row']} | {u['field']}  ({u['note']})")

        out = Path(path).with_suffix("").name + "_reading.json"
        Path(out).write_text(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"\nsaved {out}   total time {time.time() - start:.1f}s   (model: {ai.MODEL}, thinking: {ai.THINKING})")
        print("Gemini calls:")
        for t in ai.TIMINGS:
            extra = f"   tries: {t['tries']}  last error: {t['error']}" if t["tries"] > 1 else \
                (f"   ({t['error']})" if t["error"] else "")
            print(f"  {t['what']:<12} {t['seconds']:>5}s{extra}")

        if want_note:
            fake = [{"page": 1, "section": "Test section", "row": "Test row", "field": "Date",
                     "kind": "missing", "message": "Date is blank."}]
            print("\ncorrection note test:\n" + ai.correction_note(form_type, fake))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        sys.exit(1)
    main(args, want_note="--note" in sys.argv)
