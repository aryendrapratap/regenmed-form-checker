"""
ai.py  -  Person 1 (the reader)

Asks Gemini which RegenMed form a scan is, and types the form out into the
layouts the team agreed on (plan doc: "How the files connect").

Used by the rest of the app:
    identify_form(pages)                  -> "MP-F-023" | "QS-F-049" | "LOT_LOG" | "UNKNOWN"
    read_form(pages, form_type)           -> dict in the agreed layout, plus "unsure"
    correction_note(form_type, problems)  -> short text note for staff

`pages` is a list of PIL images, one per page, upright (from rules.pdf_to_pages).

The Gemini key comes from the GEMINI_API_KEY environment variable, or from
Streamlit secrets (GEMINI_API_KEY) when running online.
"""

from __future__ import annotations

import copy
import io
import json
import os
import re
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Settings (change here, or with environment variables)
# ---------------------------------------------------------------------------
def _setting(name: str, default: str) -> str:
    """A setting from the environment, else from .streamlit/secrets.toml (or the online app's Secrets), else default."""
    if os.environ.get(name):
        return os.environ[name]
    try:
        import streamlit as st
        return str(st.secrets.get(name, default))
    except Exception:
        return default


MODEL = _setting("GEMINI_MODEL", "gemini-3-flash-preview")      # fastest Flash model in tests, same accuracy
IMAGE_DETAIL = _setting("GEMINI_IMAGE_DETAIL", "high")            # low, medium, high, ultra_high
THINKING = _setting("GEMINI_THINKING", "minimal")                 # minimal, low, medium, high ("" = model default)
SECOND_OPINION = _setting("GEMINI_SECOND_OPINION", "1") != "0"    # ask twice and compare blanks ("0" = half the calls)
QUICK_ID = _setting("QUICK_ID", "1") != "0"                       # recognise the form by its layout first (no AI, instant)

# The organizers' hackathon Gemini API. It only accepts text, so it writes the correction note;
# reading the scanned forms needs the Google key above. Leave HACKATHON_API_KEY empty to skip it.
HACKATHON_URL = "https://hackathon-api-new-152590733511.northamerica-northeast2.run.app/api/generate"
HACKATHON_MODEL = _setting("HACKATHON_MODEL", "")      # empty = the organizers' default model
HACKATHON_REMAINING = None                             # requests left on the organizers' key, after each call

FORM_NAMES = {
    "MP-F-023": "MP-F-023 · MS Processing Instructions / Tissue Open Checklist",
    "QS-F-049": "QS-F-049 · Technical/Quality Review and Disposition Statement",
    "LOT_LOG": "Lot Log · MS Processing & Packaging Lot Log",
    "DISCARD": "Discard Form · Tissue Discard Form (MP-F-018)",
}

# Filled in by read_form so you can look at both of Gemini's raw answers while testing.
LAST_READINGS: dict = {}
# One entry per Gemini call: how long it took and how many tries. try_ai.py prints these.
TIMINGS: list = []


class GeminiError(RuntimeError):
    """Gemini could not be reached, or its answer could not be used."""


# ---------------------------------------------------------------------------
# Layouts Gemini must reply in (one per form / page)
# ---------------------------------------------------------------------------
_EMPTY = "null if the box is empty."
_EXACT = "Exactly as written. " + _EMPTY


class _ByDate(BaseModel):
    initials: Optional[str] = Field(None, description="Initials written in this box. " + _EXACT)
    date: Optional[str] = Field(None, description="Date written in this box, not reformatted. " + _EXACT)


class _MPTop(BaseModel):
    donor_no: Optional[str] = Field(None, description="Value of 'Donor #' (top-left box). " + _EXACT)
    verified_by: Optional[str] = Field(None, description="Initials in the 'Verified By' box under Donor #. " + _EXACT)
    cross_reference_no: Optional[str] = Field(None, description="'Cross Reference #'. " + _EXACT)
    donor_sex: Optional[str] = Field(None, description="'Donor Sex'. " + _EXACT)
    donor_age: Optional[str] = Field(None, description="'Donor Age'. " + _EXACT)
    date_of_recovery: Optional[str] = Field(None, description="'Date of Recovery'. " + _EXACT)
    instruction_verification: Optional[str] = Field(
        None, description="All initials in the 'Instruction Verification' box, separated by spaces. " + _EMPTY)
    date_of_processing: Optional[str] = Field(None, description="'Date of Processing'. " + _EXACT)
    clean_room_log_review: _ByDate = Field(description="'Clean Room Log Review By / Date' box.")
    tissue_checked_in: _ByDate = Field(description="'Tissue Checked In By / Date' box.")


class _MPRow(BaseModel):
    item: str = Field(description="Tissue name in the 'Processing Instructions' column.")
    produced: Optional[str] = Field(None, description="'# Produced' value. If crossed out and rewritten, the new value. " + _EMPTY)
    packaged: Optional[str] = Field(None, description="'# Packaged' value. If crossed out and rewritten, the new value. " + _EMPTY)
    crossed_out: bool = Field(False, description="true only if a line is drawn through the whole row to void it.")


class _MPLabel(BaseModel):
    tgln: Optional[str] = Field(None, description="Value after 'TGLN#:'. " + _EMPTY)
    regenmed_id: Optional[str] = Field(None, description="Value after 'RegenMed ID:'. " + _EMPTY)
    side_circled: Optional[str] = Field(None, description="'LEFT' or 'RIGHT' for the side that is circled, null if neither.")


class MPF023(BaseModel):
    top: _MPTop
    ops_manager_review: _ByDate = Field(description="Initials and date on the 'Operations Manager Review' line.")
    processing_rows: List[_MPRow]
    labels: List[_MPLabel]


class _Review(BaseModel):
    initials: Optional[str] = Field(None, description="Initials in this box. " + _EXACT)
    date: Optional[str] = Field(None, description="Date in this box, not reformatted. " + _EXACT)
    na: bool = Field(False, description="true if the box says N/A (or NA).")


class _QSRow(BaseModel):
    item: int = Field(description="Item number, 1 to 10.")
    technical: _Review = Field(description="Box in the 'Technical' column of 'Reviewed By/Date'.")
    quality: _Review = Field(description="Box in the 'Quality' column of 'Reviewed By/Date'.")


class _Item10(BaseModel):
    inc_number: Optional[str] = Field(None, description="Value written after 'INC #:' in item 10. " + _EXACT)
    status: Optional[str] = Field(None, description="Value after 'Status:' in item 10. If crossed out and rewritten, the new value. " + _EMPTY)


class QSF049(BaseModel):
    review_rows: List[_QSRow] = Field(min_length=10, max_length=10)
    item10: _Item10


class _LotItem(BaseModel):
    item: str = Field(description="Name in the 'Item' column.")
    lot: Optional[str] = Field(None, description="'Lot Number'. " + _EXACT)
    exp: Optional[str] = Field(None, description="'Exp. Date'. " + _EXACT)
    manufacturer: Optional[str] = Field(None, description="'Manufacturer'. " + _EXACT)
    crossed_out: bool = Field(False, description="true only if a line is drawn through the whole row to void it.")


class _LotQty(BaseModel):
    item: str = Field(description="Name in the first column of the row (the item or packaging size).")
    lot: Optional[str] = Field(None, description="'Lot'. " + _EXACT)
    qty_used: Optional[str] = Field(None, description="'Qty Used'. Tally marks count: write them as seen, e.g. '|' or '||'. " + _EMPTY)
    crossed_out: bool = Field(False, description="true only if a line is drawn through the whole row to void it.")


class _LoadItem(BaseModel):
    side: str = Field(description="'left' for the left table, 'right' for the right table.")
    item: str = Field(description="Name in the 'Item' column.")
    load: Optional[str] = Field(None, description="Both numbers in 'Load #', separated by a space, e.g. '2 3'. null only if the whole cell is empty.")
    sterilization_date: Optional[str] = Field(None, description="'Sterilization Date'. " + _EXACT)
    crossed_out: bool = Field(False, description="true only if a line is drawn through the whole row to void it.")


class _Reading(BaseModel):
    room_temp: Optional[str] = Field(None, description="Room Temp. " + _EXACT)
    room_rh: Optional[str] = Field(None, description="Room RH. " + _EXACT)
    room_to_antechamber: Optional[str] = Field(None, description="Room to Antechamber pressure. " + _EXACT)
    antechamber_to_hallway: Optional[str] = Field(None, description="Antechamber to Hallway pressure. " + _EXACT)


class LotPage1(BaseModel):
    printed_page_number: Optional[int] = Field(None, description="X in 'Page X of 2' at the bottom.")
    page1_items: List[_LotItem]
    page1_regenmed_items: List[_LotQty]
    readings_processing: _Reading
    readings_packaging: _Reading


class LotPage2(BaseModel):
    printed_page_number: Optional[int] = Field(None, description="X in 'Page X of 2' at the bottom.")
    page2_items: List[_LoadItem]
    page2_packaging: List[_LotQty]


class _DiscardTop(BaseModel):
    donor_no: Optional[str] = Field(None, description="'Donor #'. " + _EXACT)
    authorized: _ByDate = Field(description="'Discard Authorized By/Date': who authorized (initials, name or signature) and the date.")
    reason: Optional[str] = Field(None, description="'Reason for Discard'. " + _EXACT)


class _DiscardStatus(BaseModel):
    unprocessed: bool = Field(False, description="true if the 'Unprocessed Tissue' box is checked.")
    in_processing: bool = Field(False, description="true if the 'In Processing Tissue' box is checked.")
    unreleased_packaged: bool = Field(False, description="true if the 'Unreleased Packaged Tissue' box is checked.")
    released_packaged: bool = Field(False, description="true if the 'Released Packaged Tissue' box is checked.")


class _DiscardRow(BaseModel):
    item: str = Field(description="What is written in 'Tissue Description' for this row.")
    graft_id: Optional[str] = Field(None, description="'Graft IDs' for this row exactly as written, e.g. 'N/A'. "
                                                      "Write '-' if only a dash or line is drawn. " + _EMPTY)
    storage_location: Optional[str] = Field(None, description="'Storage Location'. Write '-' if only a dash is drawn. " + _EMPTY)
    x_marked: bool = Field(False, description="true if the small box in the 'X' column at the end of this row has a mark in it.")
    crossed_out: bool = Field(False, description="true only if a line is drawn through the whole row to void it.")


class _DiscardBottom(BaseModel):
    tissue_discarded_by: Optional[str] = Field(None, description="'Tissue Discarded By'. " + _EXACT)
    confirmed_by: Optional[str] = Field(None, description="'Confirmed By'. " + _EXACT)
    discard_date: Optional[str] = Field(None, description="'Date' on the same line as Tissue Discarded By. " + _EXACT)
    freezerpro_updated_by: Optional[str] = Field(None, description="'FreezerPro Updated By' under 'Released Packaged Tissue'. " + _EXACT)
    freezerpro_date: Optional[str] = Field(None, description="'Date' under 'Released Packaged Tissue'. " + _EXACT)
    log_updated_by: Optional[str] = Field(None, description="'Log / FreezerPro Updated By' under 'Unprocessed Tissue, In Processing Tissue, "
                                                            "Unreleased Packaged Tissue'. " + _EXACT)
    log_date: Optional[str] = Field(None, description="'Date' under 'Unprocessed Tissue, In Processing Tissue, Unreleased Packaged Tissue'. " + _EXACT)


class DiscardForm(BaseModel):
    top: _DiscardTop
    status: _DiscardStatus
    tissues: List[_DiscardRow]
    bottom: _DiscardBottom


class _Identify(BaseModel):
    form_code: Optional[str] = Field(None, description="Form code printed in the bottom-right corner, e.g. 'QS-F-049.010'. null if none.")
    title: Optional[str] = Field(None, description="Main title printed at the top of the page. null if none.")


# ---------------------------------------------------------------------------
# What we ask Gemini
# ---------------------------------------------------------------------------
_COMMON = """You are reading a scanned, hand-filled RegenMed form for a quality check.
Rules for your answer:
- Copy what is written exactly, including "N/A". Do not fix, reformat or guess anything. Keep dates exactly as written.
- If a box is empty, use null. Never invent a value for an empty box, and never copy a value from a nearby box.
- If a value was crossed out and a new value written next to it, give the new value.
- A table row counts only if an item name is printed or handwritten in it. Skip rows with no item name.
- Include rows that were added by hand.
- Set crossed_out to true only when a line is drawn through a whole row to void it.
"""

_SECOND = """
Extra care: look at every box on its own, one at a time. Many boxes on this form may be empty on purpose.
Report a box as null unless you can clearly see writing inside that exact box.
"""

_MP_PROMPT = _COMMON + """
This is form MP-F-023 "MS Processing Instructions / Tissue Open Checklist" (1 page). Read:
1. top: the row of boxes across the very top, from "Donor #" to "Tissue Checked In By / Date".
   The "Clean Room Log Review By / Date" and "Tissue Checked In By / Date" boxes each hold initials and a date.
2. ops_manager_review: initials and date written on the line "Operations Manager Review - Initials / Date (MM/DD/YY)".
3. processing_rows: every row of the "Processing Instructions" table in the lower half, top to bottom, with the
   "# Produced" and "# Packaged" columns. The printed rows are usually: Posterior Tibialis, Anterior Tibialis,
   Peroneus Longus, Gracilis, Semitendinosus, Patellar Ligament, Femoral Head, Humeral Head, Tri-Cortical Block,
   Cancellous 1-10 mm, Cancellous 4-10 mm, Cancellous 1-4 mm, Cancellous 3-6 mm, Tibia Shaft, Humerus Shaft,
   Femur Shaft, Fibula Shaft. Only include rows you actually see. Skip the empty spacer rows between groups.
4. labels: each "TGLN#" / "RegenMed ID" block in the middle of the page, and which side is circled.
"""

_QS_PROMPT = _COMMON + """
This is form QS-F-049 "Technical/Quality Review and Disposition Statement" (1 page). Read:
1. review_rows: items 1 to 10 of "Technical and Quality Review Elements". For each item, read the two
   "Reviewed By/Date" boxes on the right: the Technical column and the Quality column. Each box usually has
   initials above a date. If a box says N/A, set na to true, and fill initials and date only if they are also written.
   Return exactly 10 rows, item 1 to item 10, in order.
   Each item's boxes are in the same row as its item number. Boxes differ in height (item 1 is tall, and its date
   may sit higher up). Read each box on its own and never copy a value from the item above or below.
2. item10: in item 10, the value written after "INC #:" and the value after "Status:".
"""

_LOT_P1_PROMPT = _COMMON + """
This is page 1 of the "MS Processing & Packaging Lot Log" (form code MP-F-021). Read:
1. printed_page_number: X in "Page X of 2" at the bottom.
2. page1_items: every row of the big table with columns "Item", "Lot Number", "Exp. Date", "Manufacturer",
   top to bottom, including handwritten rows.
3. page1_regenmed_items: every row of the "RegenMed Item" table with columns "Lot" and "Qty Used".
   Qty Used is often a tally mark such as "|" or "||": write it as you see it.
4. readings_processing and readings_packaging: from the PROCESSING box and the PACKAGING box at the top,
   the Room Temp, Room RH, Room to Antechamber and Antechamber to Hallway values, exactly as written.
"""

_LOT_P2_PROMPT = _COMMON + """
This is page 2 of the "MS Processing & Packaging Lot Log" (form code MP-F-021). Read:
1. printed_page_number: X in "Page X of 2" at the bottom.
2. page2_items: every row of BOTH item tables with columns "Item", "Load #", "Sterilization Date":
   first the left table top to bottom (side "left"), then the right table top to bottom (side "right").
   "Load #" has two small boxes: write both numbers separated by a space, e.g. "2 3".
3. page2_packaging: every row of the "Packaging" table at the bottom right, with columns "Lot" and "Qty Used".
   The "Packaging" column is the item name, e.g. "8x18 (10)". Qty Used may be tally marks: write them as seen.
"""

_DISCARD_PROMPT = _COMMON + """
This is a RegenMed "Tissue Discard Form" (form code MP-F-018), 1 page. Read:
1. top: "Donor #", "Discard Authorized By/Date" (who, as initials, name or signature, and the date) and "Reason for Discard".
2. status: which "Tissue Status" boxes are checked: Unprocessed Tissue, In Processing Tissue,
   Unreleased Packaged Tissue, Released Packaged Tissue.
3. tissues: every row of the table with columns "Graft IDs", "Tissue Description", "Storage Location" and the small "X" box
   at the end, top to bottom. Only rows with a tissue description. For each row say whether its X box is marked.
4. bottom: every field in the bottom section: Tissue Discarded By, Confirmed By, Date, FreezerPro Updated By and its Date
   (Released Packaged Tissue), Log / FreezerPro Updated By and its Date (Unprocessed / In Processing / Unreleased Packaged Tissue).
Ignore notes written outside the boxes.
"""

_IDENTIFY_PROMPT = """This is a scanned page. What form code is printed in the bottom-right corner
(for example "QS-F-049.010"), and what is the main title at the top of the page? Use null if there is none."""


# ---------------------------------------------------------------------------
# Talking to Gemini
# ---------------------------------------------------------------------------
_client = None
_client_lock = threading.Lock()


def _api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if key:
        return key
    try:
        import streamlit as st  # only available in the web app
        return st.secrets["GEMINI_API_KEY"]
    except Exception:
        pass
    raise GeminiError("No Gemini key found. Set GEMINI_API_KEY, or add it to the app's Streamlit secrets.")


def _get_client():
    """One shared connection. The lock stops two readings running at once from each making one."""
    global _client
    with _client_lock:
        if _client is None:
            from google import genai
            _client = genai.Client(api_key=_api_key())
        return _client


def _image_part(img, detail: str | None = None) -> dict:
    """One page picture, ready to send to Gemini."""
    import base64
    from PIL import Image

    if isinstance(img, (str, os.PathLike)):
        img = Image.open(img)
    img = img.convert("RGB")
    if max(img.size) > 2400:  # plenty for handwriting, keeps uploads fast
        img = img.copy()
        img.thumbnail((2400, 2400))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    part = {"type": "image", "data": base64.b64encode(buf.getvalue()).decode(), "mime_type": "image/jpeg"}
    if detail or IMAGE_DETAIL:
        part["resolution"] = detail or IMAGE_DETAIL
    return part


def _schema(model: type[BaseModel]) -> dict:
    """Pydantic schema, simplified so Gemini accepts it (no $ref, nullable as ["x","null"], all fields required)."""
    raw = model.model_json_schema()
    defs = raw.pop("$defs", {})

    def fix(node, is_props=False):
        if isinstance(node, list):
            return [fix(x) for x in node]
        if not isinstance(node, dict):
            return node
        if is_props:  # keys here are field names, not schema keywords
            return {name: fix(sub) for name, sub in node.items()}
        if "$ref" in node:
            target = fix(copy.deepcopy(defs[node["$ref"].split("/")[-1]]))
            if "description" in node:
                target["description"] = node["description"]
            return target
        if "anyOf" in node:
            options = node["anyOf"]
            real = [o for o in options if o.get("type") != "null"]
            if len(options) == 2 and len(real) == 1:
                inner = fix(real[0])
                if isinstance(inner.get("type"), str):
                    inner["type"] = [inner["type"], "null"]
                if "description" in node:
                    inner["description"] = node["description"]
                return inner
        out = {}
        for key, value in node.items():
            if key in ("default", "title"):
                continue
            out[key] = fix(value, is_props=(key == "properties"))
        if "properties" in out:
            out["required"] = list(out["properties"].keys())
        return out

    return fix(raw)


def _strip_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text)
    return text


def _ask(parts, schema_model: type[BaseModel] | None = None, tries: int = 3, thinking: str | None = None):
    """Send text and/or pictures to Gemini. Returns a dict (with a layout) or text (without)."""
    body = {"model": MODEL, "input": parts}
    if thinking or THINKING:
        body["generation_config"] = {"thinking_level": thinking or THINKING}
    started = time.time()
    if schema_model is not None:
        body["response_format"] = {"type": "text", "mime_type": "application/json", "schema": _schema(schema_model)}

    last_error = None
    for attempt in range(tries):
        try:
            result = _get_client().interactions.create(**body)
            text = getattr(result, "output_text", None) or ""
            answer = text.strip() if schema_model is None else \
                schema_model.model_validate_json(_strip_fences(text)).model_dump()
            TIMINGS.append({"what": schema_model.__name__ if schema_model else "text", "seconds": round(time.time() - started, 1),
                            "tries": attempt + 1, "error": str(last_error)[:120] if last_error else ""})
            return answer
        except GeminiError:
            raise
        except Exception as error:  # network trouble, rate limit, bad JSON: wait and try again
            last_error = error
            if attempt < tries - 1:
                busy = "429" in str(error) or "RESOURCE_EXHAUSTED" in str(error).upper()
                time.sleep((10 if busy else 3) * (attempt + 1))
    TIMINGS.append({"what": schema_model.__name__ if schema_model else "text", "seconds": round(time.time() - started, 1),
                    "tries": tries, "error": str(last_error)[:120]})
    raise GeminiError(f"Gemini did not give a usable answer: {last_error}")


def _ask_hackathon(prompt: str) -> str | None:
    """Text-only question to the organizers' API. One try only: failed requests still use up their quota."""
    global HACKATHON_REMAINING
    key = _setting("HACKATHON_API_KEY", "")
    if not key:
        return None
    import requests

    body = {"contents": prompt}
    if HACKATHON_MODEL:
        body["model"] = HACKATHON_MODEL
    try:
        response = requests.post(HACKATHON_URL, headers={"X-API-Key": key}, json=body, timeout=60)
        response.raise_for_status()
        data = response.json()
        HACKATHON_REMAINING = data.get("requests_remaining")
        return (data.get("text") or "").strip() or None
    except Exception:
        return None


def _read_page(page, schema_model, prompt: str) -> dict:
    return _ask([{"type": "text", "text": prompt}, _image_part(page)], schema_model)


# ---------------------------------------------------------------------------
# 1. Which form is it?
# ---------------------------------------------------------------------------
def _form_from(code: str | None, title: str | None) -> str:
    compact = re.sub(r"[^A-Z0-9]", "", (code or "").upper()).replace("O", "0")
    if "MPF023" in compact:
        return "MP-F-023"
    if "QSF049" in compact:
        return "QS-F-049"
    if "MPF021" in compact:
        return "LOT_LOG"
    if "MPF018" in compact:
        return "DISCARD"
    words = (title or "").lower()
    if "tissue open" in words or "processing instructions" in words:
        return "MP-F-023"
    if "disposition" in words or "technical/quality" in words or "quality review" in words:
        return "QS-F-049"
    if "lot log" in words:
        return "LOT_LOG"
    if "discard" in words:
        return "DISCARD"
    return "UNKNOWN"


def identify_form(pages) -> str:
    """Return "MP-F-023", "QS-F-049", "LOT_LOG", "DISCARD" or "UNKNOWN"."""
    pages = list(pages)
    if QUICK_ID and pages:
        started = time.time()
        try:
            import quick_id
            form = quick_id.identify(pages[0])
        except Exception:
            form = None
        TIMINGS.append({"what": "layout match", "seconds": round(time.time() - started, 2), "tries": 1,
                        "error": "" if form else "no clear match, asking Gemini"})
        if form:
            return form
    for page in pages[:2]:  # page 1, then page 2 if page 1 gave no answer
        answer = _ask([{"type": "text", "text": _IDENTIFY_PROMPT}, _image_part(page, detail="medium")], _Identify,
                      thinking="minimal")
        form = _form_from(answer.get("form_code"), answer.get("title"))
        if form != "UNKNOWN":
            return form
    return "UNKNOWN"


# ---------------------------------------------------------------------------
# 2. Type out the form
# ---------------------------------------------------------------------------
# Which parts of each form to double-check. "rows": a table; otherwise fixed boxes.
_CHECKS = {
    "MP-F-023": [
        {"path": "top", "page": 1, "section": "Top row", "fields": {
            "donor_no": "Donor #", "verified_by": "Verified By", "cross_reference_no": "Cross Reference #",
            "donor_sex": "Donor Sex", "donor_age": "Donor Age", "date_of_recovery": "Date of Recovery",
            "instruction_verification": "Instruction Verification", "date_of_processing": "Date of Processing",
            "clean_room_log_review.initials": "Clean Room Log Review By",
            "clean_room_log_review.date": "Clean Room Log Review Date",
            "tissue_checked_in.initials": "Tissue Checked In By", "tissue_checked_in.date": "Tissue Checked In Date"}},
        {"path": "ops_manager_review", "page": 1, "section": "Operations Manager Review",
         "fields": {"initials": "Initials", "date": "Date"}},
        {"path": "processing_rows", "rows": True, "page": 1, "section": "Processing Instructions",
         "fields": {"produced": "# Produced", "packaged": "# Packaged", "crossed_out": "Crossed out"}},
    ],
    "QS-F-049": [
        {"path": "review_rows", "rows": True, "key": "item", "page": 1, "section": "Reviewed By/Date", "fields": {
            "technical.initials": "Technical initials", "technical.date": "Technical date", "technical.na": "Technical N/A",
            "quality.initials": "Quality initials", "quality.date": "Quality date", "quality.na": "Quality N/A"}},
        {"path": "item10", "page": 1, "section": "Item 10", "fields": {"inc_number": "INC #", "status": "Status"}},
    ],
    "DISCARD": [
        {"path": "top", "page": 1, "section": "Top", "fields": {
            "donor_no": "Donor #", "authorized.initials": "Discard Authorized By",
            "authorized.date": "Discard Authorized Date", "reason": "Reason for Discard"}},
        {"path": "status", "page": 1, "section": "Tissue Status", "fields": {
            "unprocessed": "Unprocessed Tissue", "in_processing": "In Processing Tissue",
            "unreleased_packaged": "Unreleased Packaged Tissue", "released_packaged": "Released Packaged Tissue"}},
        {"path": "tissues", "rows": True, "page": 1, "section": "Tissue list",
         "fields": {"graft_id": "Graft ID", "x_marked": "X box", "crossed_out": "Crossed out"}},
        {"path": "bottom", "page": 1, "section": "Bottom", "fields": {
            "tissue_discarded_by": "Tissue Discarded By", "confirmed_by": "Confirmed By", "discard_date": "Date",
            "freezerpro_updated_by": "FreezerPro Updated By", "freezerpro_date": "FreezerPro Date",
            "log_updated_by": "Log / FreezerPro Updated By", "log_date": "Log Date"}},
    ],
    "LOT_LOG": [
        {"path": "page1_items", "rows": True, "page": 1, "section": "Item table",
         "fields": {"lot": "Lot Number", "exp": "Exp. Date", "manufacturer": "Manufacturer", "crossed_out": "Crossed out"}},
        {"path": "page1_regenmed_items", "rows": True, "page": 1, "section": "RegenMed Item table",
         "fields": {"lot": "Lot", "qty_used": "Qty Used", "crossed_out": "Crossed out"}},
        {"path": "page2_items", "rows": True, "page": 2, "section": "Item table",
         "fields": {"load": "Load #", "sterilization_date": "Sterilization Date", "crossed_out": "Crossed out"}},
        {"path": "page2_packaging", "rows": True, "page": 2, "section": "Packaging table",
         "fields": {"lot": "Lot", "qty_used": "Qty Used", "crossed_out": "Crossed out"}},
    ],
}


def _get(obj, dotted: str):
    for part in dotted.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def _set(obj, dotted: str, value):
    parts = dotted.split(".")
    for part in parts[:-1]:
        obj = obj.setdefault(part, {})
    obj[parts[-1]] = value


def _filled(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() not in ("", "null", "None")
    return bool(value)


def _row_keys(rows: list, key_field: str | None) -> list:
    """A matching key per row: its item number, or its (side, name, nth time this name appears)."""
    if key_field:
        return [row.get(key_field) for row in rows]
    seen, keys = Counter(), []
    for row in rows:
        name = re.sub(r"[^a-z0-9]", "", str(row.get("item", "")).lower())
        base = (row.get("side"), name)
        seen[base] += 1
        keys.append(base + (seen[base],))
    return keys


# Fields where the exact text matters to a rule, so the two readings must also agree on WHAT is written.
_VALUE_FIELDS = {"QS-F-049": ("technical.date", "quality.date", "inc_number"),
                 "DISCARD": ("graft_id",)}


def _same_text(a, b) -> bool:
    norm = lambda v: re.sub(r"[^A-Z0-9]", "", str(v).upper())
    return norm(a) == norm(b)


def _compare(first: dict, second: dict, form_type: str) -> tuple[dict, list]:
    """Merge two readings. Where they disagree about a box being empty (or, for some fields, what it says),
    keep the first reading and mark the box unsure."""
    merged = copy.deepcopy(first)
    unsure = []
    value_fields = _VALUE_FIELDS.get(form_type, ())

    def differ(key, a, b):
        return key in value_fields and _filled(a) and _filled(b) and not _same_text(a, b)

    def note(check, row, row_number, key, label, why):
        unsure.append({"page": check["page"], "section": check["section"], "row": row, "row_number": row_number,
                       "field": label, "path": check["path"], "key": key, "note": why})

    for check in _CHECKS[form_type]:
        path = check["path"]
        if not check.get("rows"):
            box_a, box_b = _get(merged, path) or {}, _get(second, path) or {}
            for key, label in check["fields"].items():
                a, b = _get(box_a, key), _get(box_b, key)
                if _filled(a) != _filled(b):
                    note(check, None, None, key, label, "The two readings disagree about whether this box is empty.")
                    if not _filled(a):
                        _set(box_a, key, b)
                elif differ(key, a, b):
                    note(check, None, None, key, label, f"The two readings disagree about what is written (\"{a}\" or \"{b}\").")
            continue

        rows_a, rows_b = _get(merged, path) or [], _get(second, path) or []
        keys_a, keys_b = _row_keys(rows_a, check.get("key")), _row_keys(rows_b, check.get("key"))
        by_key_b = dict(zip(keys_b, rows_b))
        known_a = set(keys_a)
        for number, (row_key, row) in enumerate(zip(keys_a, rows_a), start=1):
            name = f"Item {row['item']}" if check.get("key") else row.get("item")
            other = by_key_b.get(row_key)
            if other is None:
                note(check, name, number, None, "Whole row", "Only one of the two readings found this row.")
                continue
            for key, label in check["fields"].items():
                a, b = _get(row, key), _get(other, key)
                if _filled(a) != _filled(b):
                    note(check, name, number, key, label, "The two readings disagree about whether this box is empty.")
                    if not _filled(a):
                        _set(row, key, b)
                elif differ(key, a, b):
                    note(check, name, number, key, label,
                         f"The two readings disagree about what is written (\"{a}\" or \"{b}\").")
        for row_key, row in zip(keys_b, rows_b):
            if row_key not in known_a:
                name = f"Item {row['item']}" if check.get("key") else row.get("item")
                note(check, name, None, None, "Whole row", "Only one of the two readings found this row; it was not checked.")
    return merged, unsure


def _number_rows(data: dict, form_type: str) -> None:
    """Give every table row a row_number (1, 2, 3...) so problems can say exactly where they are."""
    for check in _CHECKS[form_type]:
        if check.get("rows"):
            for number, row in enumerate(_get(data, check["path"]) or [], start=1):
                row["row_number"] = number


def _run_all(jobs: list) -> list:
    """Run several Gemini questions at the same time. jobs = [(page, layout, prompt), ...]"""
    with ThreadPoolExecutor(max_workers=max(1, min(8, len(jobs)))) as pool:
        futures = [pool.submit(_read_page, *job) for job in jobs]
        return [future.result() for future in futures]


def _read_lot_log(pages: list) -> tuple[dict, dict | None]:
    """Read both Lot Log pages (twice each if SECOND_OPINION). Returns (first reading, second reading)."""
    pages = list(pages)
    have_page2 = len(pages) >= 2
    rounds = 2 if SECOND_OPINION else 1

    def read(p1, p2):
        jobs = []
        for r in range(rounds):
            extra = _SECOND if r == 1 else ""
            jobs.append((p1, LotPage1, _LOT_P1_PROMPT + extra))
            if p2 is not None:
                jobs.append((p2, LotPage2, _LOT_P2_PROMPT + extra))
        return _run_all(jobs)

    results = read(pages[0], pages[1] if have_page2 else None)
    step = 2 if have_page2 else 1
    first_p1 = results[0]
    first_p2 = results[1] if have_page2 else None
    # Pages uploaded in the wrong order? (page 1 picture says "Page 2 of 2")
    if have_page2 and first_p1.get("printed_page_number") == 2 and first_p2.get("printed_page_number") == 1:
        results = read(pages[1], pages[0])

    readings = []
    for r in range(rounds):
        p1 = results[r * step]
        p2 = results[r * step + 1] if have_page2 else {"page2_items": [], "page2_packaging": []}
        readings.append({
            "page1_items": p1.get("page1_items", []),
            "page1_regenmed_items": p1.get("page1_regenmed_items", []),
            "page2_items": p2.get("page2_items", []),
            "page2_packaging": p2.get("page2_packaging", []),
            "readings": {"processing": p1.get("readings_processing"), "packaging": p1.get("readings_packaging")},
            "missing_pages": [] if have_page2 else [2],
        })
    return readings[0], (readings[1] if rounds == 2 else None)


def _read_discards(pages: list) -> dict:
    """Each page of the PDF is its own Discard Form. Returns {"forms": [...], "unsure": [...]}."""
    rounds = 2 if SECOND_OPINION else 1
    jobs = [(page, DiscardForm, _DISCARD_PROMPT + (_SECOND if r == 1 else "")) for page in pages for r in range(rounds)]
    answers = _run_all(jobs)
    forms, unsure = [], []
    for index in range(len(pages)):
        first = answers[index * rounds]
        second = answers[index * rounds + 1] if rounds == 2 else None
        if second is not None:
            form, notes = _compare(first, second, "DISCARD")
        else:
            form, notes = copy.deepcopy(first), []
        _number_rows(form, "DISCARD")
        form["page"] = index + 1
        for note in notes:
            note["page"] = index + 1
            note["path"] = f"forms.{index}.{note['path']}"
        forms.append(form)
        unsure.extend(notes)
    LAST_READINGS.clear()
    LAST_READINGS.update({"form_type": "DISCARD", "answers": answers})
    return {"form_type": "DISCARD", "forms": forms, "unsure": unsure}


def read_form(pages, form_type: str) -> dict:
    """Type out the form into the team's agreed layout. Adds "unsure": boxes where Gemini's two readings disagreed."""
    pages = list(pages)
    if not pages:
        raise ValueError("No pages to read.")

    if form_type == "DISCARD":
        return _read_discards(pages)
    if form_type == "LOT_LOG":
        first, second = _read_lot_log(pages)
    elif form_type in ("MP-F-023", "QS-F-049"):
        layout, prompt = (MPF023, _MP_PROMPT) if form_type == "MP-F-023" else (QSF049, _QS_PROMPT)
        jobs = [(pages[0], layout, prompt)]
        if SECOND_OPINION:
            jobs.append((pages[0], layout, prompt + _SECOND))
        answers = _run_all(jobs)
        first, second = answers[0], (answers[1] if SECOND_OPINION else None)
        if form_type == "QS-F-049":
            for answer in answers:
                answer["review_rows"] = sorted(answer.get("review_rows", []), key=lambda row: row.get("item", 0))
    else:
        raise ValueError(f"Can't read form type {form_type!r}.")

    LAST_READINGS.clear()
    LAST_READINGS.update({"form_type": form_type, "first": first, "second": second})

    if second is not None:
        data, unsure = _compare(first, second, form_type)
    else:
        data, unsure = copy.deepcopy(first), []
    _number_rows(data, form_type)
    data["form_type"] = form_type
    data["unsure"] = unsure
    return data


# ---------------------------------------------------------------------------
# 3. Correction note
# ---------------------------------------------------------------------------
def _plain_note(form_type: str, problems: list) -> str:
    lines = [f"Please fix the following on {FORM_NAMES.get(form_type, form_type)}:"]
    for p in problems:
        where = ", ".join(str(x) for x in (f"page {p.get('page')}" if p.get("page") else None,
                                           p.get("section"), p.get("row")) if x)
        lines.append(f"- {where}: {p.get('message')}")
    return "\n".join(lines)


def correction_note(form_type: str, problems: list) -> str:
    """A short, polite note telling staff what to fix. Falls back to a plain list if Gemini is unavailable."""
    to_fix = [p for p in problems if p.get("kind") != "extra_note"]
    if not to_fix:
        return "No corrections needed. The form passed all checks."
    listing = "\n".join(
        f"- page {p.get('page')} | {p.get('section')} | {p.get('row') or '-'} | {p.get('field') or '-'} | "
        f"{p.get('kind')} | {p.get('message')}" for p in to_fix)
    prompt = (
        f"Write a short, polite note to the staff member who filled in RegenMed form "
        f"{FORM_NAMES.get(form_type, form_type)}, asking them to fix the problems below.\n"
        "Start with one sentence. Then one bullet per problem, grouped by page and section, in plain words. "
        "For 'please_check' items, ask them to double-check rather than saying it is wrong. "
        "No greeting, no sign-off, no extra advice.\n\nProblems:\n" + listing)
    note = _ask_hackathon(prompt)          # 1st choice: the organizers' key (text only)
    if note:
        return note
    try:                                    # 2nd choice: the Google key
        return _ask([{"type": "text", "text": prompt}]) or _plain_note(form_type, to_fix)
    except GeminiError:                     # last resort: a plain list, no AI
        return _plain_note(form_type, to_fix)
