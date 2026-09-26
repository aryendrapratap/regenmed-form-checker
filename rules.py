"""
rules.py  -  Person 2 (the checker)

Turns the PDF into pictures, and checks the typed-out form (from ai.read_form)
against RegenMed's official rules. No AI in this file: plain, predictable checks.

Used by the rest of the app:
    pdf_to_pages(pdf_bytes)        -> list of upright page pictures (PIL images)
    check_form(form_type, data)    -> list of problems; empty list = passed

Each problem looks like:
    {"page": 2, "section": "Item table", "row": "Sieve", "row_number": 17, "field": "Load #",
     "kind": "missing",        # "missing", "wrong_format", "inconsistent", "please_check" or "extra_note"
     "message": "Load # is blank.",
     "rule": "Page 2 Item section: Load # and Sterilization Date must not be blank."}
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Switches: change these once the organizers answer our questions
# ---------------------------------------------------------------------------
# "X or Y must not be blank": True = both must be filled. False = at least one.
BOTH_REQUIRED = True
# QS-F-049 dates: False = 11-29-24, 11.29.24 and 11/29/24 are all fine. True = only 11/29/24.
SLASHES_ONLY = False

RULES = {
    "mp_top": "Top of the form, Donor # to Tissue Checked In By/Date: no blank fields.",
    "mp_bydate": "Any By/Date field must have both initials and a date.",
    "mp_ops": "Operations Manager Review must have initials and a date.",
    "mp_rows": "# Produced and # Packaged must not be blank for the white (non-shaded) rows.",
    "qs_review": "Reviewed By/Date (Technical and Quality): every row needs initials and a date, or N/A.",
    "qs_date": "Reviewed By/Date dates must be in MM/DD/YY format.",
    "qs_inc": "Item 10: if an INC # is entered, Status must also be filled.",
    "lot_p1_items": "Page 1 Item section: Lot Number, Exp. Date and Manufacturer must not be blank (N/A if not used).",
    "lot_p1_regen": "Page 1 RegenMed Item section: Lot and Qty Used must not be blank.",
    "lot_p2_items": "Page 2 Item section: Load # and Sterilization Date must not be blank.",
    "lot_p2_pack": "Page 2 Packaging section: Lot and Qty Used must not be blank.",
    "lot_pages": "The Lot Log has 2 pages.",
    "dc_top": "Top of the form: Donor #, Discard Authorized By/Date and Reason for Discard must not be blank; "
              "Discard Authorized By/Date needs both initials and a date.",
    "dc_status": "Top of the form: one of the Tissue Status boxes must be checked.",
    "dc_graft": "If a Graft ID is listed, Tissue Status must be Unreleased Packaged Tissue or Released Packaged Tissue.",
    "dc_na": "If the Graft IDs are N/A, Tissue Status must be Unprocessed Tissue or In Processing Tissue.",
    "dc_x": "Middle of the form: the small X box at the end must be completed for each listed tissue.",
    "dc_bottom": "Bottom of the form: none of the fields may be left blank.",
    "crossed": "Crossed-out rows are left for a person to confirm.",
    "unsure": "The AI read this box twice and got different answers, so a person should look.",
    "unread": "Part of the form could not be read.",
    "extra_readings": "Extra check: room readings against the limits printed on the form.",
    "extra_ids": "Extra check: label numbers should match the top of the form.",
}


# ---------------------------------------------------------------------------
# PDF -> pictures
# ---------------------------------------------------------------------------
def pdf_to_pages(pdf_bytes, dpi: int = 200) -> list:
    """One upright picture per page. Raises ValueError if the file isn't a readable PDF."""
    import pymupdf
    from PIL import Image

    try:
        if isinstance(pdf_bytes, (bytes, bytearray)):
            doc = pymupdf.open(stream=bytes(pdf_bytes), filetype="pdf")
        else:
            doc = pymupdf.open(pdf_bytes)
    except Exception as error:
        raise ValueError("This file isn't a readable PDF.") from error
    if doc.needs_pass:
        raise ValueError("This PDF is password-protected.")
    if doc.page_count == 0:
        raise ValueError("This PDF has no pages.")
    if doc.page_count > 10:
        raise ValueError("This PDF has more than 10 pages. Please upload one form at a time.")

    pages = []
    for page in doc:  # PyMuPDF applies each page's saved rotation, so pages come out upright
        pix = page.get_pixmap(dpi=dpi)
        pages.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    return pages


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def blank(value) -> bool:
    """True if a box has nothing in it. "N/A" counts as filled."""
    return value is None or (isinstance(value, str) and value.strip() in ("", "null", "None"))


_DATE = re.compile(r"^\s*(\d{1,2})\s*([/\-.])\s*(\d{1,2})\s*([/\-.])\s*(\d{2})\s*$")


def is_mm_dd_yy(text: str) -> bool:
    match = _DATE.match(text or "")
    if not match:
        return False
    month, sep1, day, sep2, _ = match.groups()
    if SLASHES_ONLY and (sep1 != "/" or sep2 != "/"):
        return False
    return 1 <= int(month) <= 12 and 1 <= int(day) <= 31


def _problem(page, section, row, field, kind, message, rule, row_number=None) -> dict:
    return {"page": page, "section": section, "row": row, "row_number": row_number, "field": field,
            "kind": kind, "message": message, "rule": RULES[rule]}


def _check_pair(problems, row, fields, page, section, rule, name_key="item"):
    """Two boxes where the rule says "X or Y must not be blank"."""
    empty = [label for key, label in fields if blank(row.get(key))]
    name = row.get(name_key)
    too_few = len(empty) == len(fields) if not BOTH_REQUIRED else len(empty) > 0
    if too_few:
        what = " and ".join(empty)
        verb = "are" if len(empty) > 1 else "is"
        problems.append(_problem(page, section, name, what, "missing", f"{what} {verb} blank for {name}.",
                                 rule, row.get("row_number")))


def _crossed(problems, row, page, section, name_key="item"):
    name = row.get(name_key)
    problems.append(_problem(page, section, name, "Whole row", "please_check",
                             f"The row \"{name}\" is crossed out. Check it was voided correctly (initials and date).",
                             "crossed", row.get("row_number")))


# ---------------------------------------------------------------------------
# MP-F-023
# ---------------------------------------------------------------------------
_MP_TOP = [("donor_no", "Donor #"), ("verified_by", "Verified By"), ("cross_reference_no", "Cross Reference #"),
           ("donor_sex", "Donor Sex"), ("donor_age", "Donor Age"), ("date_of_recovery", "Date of Recovery"),
           ("instruction_verification", "Instruction Verification"), ("date_of_processing", "Date of Processing")]
_MP_BYDATE = [("clean_room_log_review", "Clean Room Log Review By/Date"),
              ("tissue_checked_in", "Tissue Checked In By/Date")]


def _check_mp_f_023(data: dict) -> list:
    problems = []
    top = data.get("top") or {}
    for key, label in _MP_TOP:
        if blank(top.get(key)):
            problems.append(_problem(1, "Top row", None, label, "missing", f"{label} is blank.", "mp_top"))
    for key, label in _MP_BYDATE:
        box = top.get(key) or {}
        missing = [part for part in ("initials", "date") if blank(box.get(part))]
        if missing:
            problems.append(_problem(1, "Top row", None, label, "missing",
                                     f"{label} is missing {' and '.join(missing)}.", "mp_bydate"))

    ops = data.get("ops_manager_review") or {}
    missing = [part for part in ("initials", "date") if blank(ops.get(part))]
    if missing:
        problems.append(_problem(1, "Operations Manager Review", None, "Initials / Date", "missing",
                                 f"Operations Manager Review is missing {' and '.join(missing)}.", "mp_ops"))

    rows = data.get("processing_rows") or []
    if not rows:
        problems.append(_problem(1, "Processing Instructions", None, None, "please_check",
                                 "The Processing Instructions table could not be read.", "unread"))
    for row in rows:
        if row.get("crossed_out"):
            _crossed(problems, row, 1, "Processing Instructions")
            continue
        _check_pair(problems, row, [("produced", "# Produced"), ("packaged", "# Packaged")],
                    1, "Processing Instructions", "mp_rows")

    # Extra: label blocks should match the top of the form
    digits = lambda s: re.sub(r"\D", "", s or "")
    for label in data.get("labels") or []:
        if label.get("tgln") and top.get("donor_no") and digits(label["tgln"]) != digits(top["donor_no"]):
            problems.append(_problem(1, "Labels", None, "TGLN#", "extra_note",
                                     f"TGLN# {label['tgln']} doesn't match Donor # {top['donor_no']}.", "extra_ids"))
        if label.get("regenmed_id") and top.get("cross_reference_no") and \
                digits(label["regenmed_id"]) != digits(top["cross_reference_no"]):
            problems.append(_problem(1, "Labels", None, "RegenMed ID", "extra_note",
                                     f"RegenMed ID {label['regenmed_id']} doesn't match Cross Reference # "
                                     f"{top['cross_reference_no']}.", "extra_ids"))
    return problems


# ---------------------------------------------------------------------------
# QS-F-049
# ---------------------------------------------------------------------------
def _check_qs_f_049(data: dict) -> list:
    problems = []
    rows = {row.get("item"): row for row in data.get("review_rows") or []}
    for item in range(1, 11):
        row = rows.get(item)
        if row is None:
            problems.append(_problem(1, "Reviewed By/Date", f"Item {item}", None, "please_check",
                                     f"Item {item} could not be read.", "unread"))
            continue
        for column in ("technical", "quality"):
            box = row.get(column) or {}
            label = column.capitalize()
            if box.get("na"):
                continue
            missing = [part for part in ("initials", "date") if blank(box.get(part))]
            if missing:
                problems.append(_problem(1, "Reviewed By/Date", f"Item {item}", label, "missing",
                                         f"Item {item}, {label}: {' and '.join(missing)} missing (or write N/A).",
                                         "qs_review", item))
            if not blank(box.get("date")) and not is_mm_dd_yy(box["date"]):
                problems.append(_problem(1, "Reviewed By/Date", f"Item {item}", f"{label} date", "wrong_format",
                                         f"Item {item}, {label}: date \"{box['date']}\" is not MM/DD/YY.",
                                         "qs_date", item))

    item10 = data.get("item10") or {}
    inc = item10.get("inc_number")
    if not blank(inc) and str(inc).strip().upper() not in ("N/A", "NA") and blank(item10.get("status")):
        problems.append(_problem(1, "Item 10", "Item 10", "Status", "missing",
                                 f"INC # {inc} is entered but Status is blank.", "qs_inc", 10))
    return problems


# ---------------------------------------------------------------------------
# Lot Log
# ---------------------------------------------------------------------------
def _number(text):
    match = re.search(r"\d+(?:\.\d+)?", (text or "").replace(",", "."))
    return float(match.group()) if match else None


def _check_readings(problems, readings: dict):
    for area, values in (readings or {}).items():
        values = values or {}
        temp, rh = _number(values.get("room_temp")), _number(values.get("room_rh"))
        if temp is not None and not 15 <= temp <= 25:
            problems.append(_problem(1, area.capitalize(), None, "Room Temp", "extra_note",
                                     f"{area.capitalize()} room temperature {values['room_temp']} is outside 15-25 °C.",
                                     "extra_readings"))
        if rh is not None and rh > 60:
            problems.append(_problem(1, area.capitalize(), None, "Room RH", "extra_note",
                                     f"{area.capitalize()} room humidity {values['room_rh']} is above 60%.",
                                     "extra_readings"))
        for key, label in (("room_to_antechamber", "Room to Antechamber"),
                           ("antechamber_to_hallway", "Antechamber to Hallway")):
            raw = values.get(key) or ""
            value = _number(raw)
            if value is None:
                continue
            in_water = "in" in raw.lower() or '"' in raw
            low = value < 0.02 if in_water else value < 4.98
            if low:
                problems.append(_problem(1, area.capitalize(), None, label, "extra_note",
                                         f"{area.capitalize()} {label} pressure {raw} is below the "
                                         f"minimum (0.02 in H2O or 4.98 Pa).", "extra_readings"))


def _check_lot_log(data: dict) -> list:
    problems = []
    for page in data.get("missing_pages") or []:
        problems.append(_problem(page, f"Page {page}", None, None, "missing",
                                 f"Page {page} of the Lot Log is missing from this PDF.", "lot_pages"))

    for row in data.get("page1_items") or []:
        if row.get("crossed_out"):
            _crossed(problems, row, 1, "Item table")
            continue
        empty = [label for key, label in (("lot", "Lot Number"), ("exp", "Exp. Date"), ("manufacturer", "Manufacturer"))
                 if blank(row.get(key))]
        if empty:
            what = " and ".join(empty)
            problems.append(_problem(1, "Item table", row.get("item"), what, "missing",
                                     f"{what} {'are' if len(empty) > 1 else 'is'} blank for {row.get('item')} "
                                     f"(write N/A if not used).", "lot_p1_items", row.get("row_number")))

    for key, page, section, fields, rule in (
            ("page1_regenmed_items", 1, "RegenMed Item table", [("lot", "Lot"), ("qty_used", "Qty Used")], "lot_p1_regen"),
            ("page2_items", 2, "Item table", [("load", "Load #"), ("sterilization_date", "Sterilization Date")], "lot_p2_items"),
            ("page2_packaging", 2, "Packaging table", [("lot", "Lot"), ("qty_used", "Qty Used")], "lot_p2_pack")):
        for row in data.get(key) or []:
            where = section + (f" ({row['side']})" if row.get("side") else "")
            if row.get("crossed_out"):
                _crossed(problems, row, page, where)
                continue
            _check_pair(problems, row, fields, page, where, rule)

    _check_readings(problems, data.get("readings"))
    return problems


# ---------------------------------------------------------------------------
# Discard Form (bonus): each page of the PDF is its own form
# ---------------------------------------------------------------------------
_STATUS = [("unprocessed", "Unprocessed Tissue"), ("in_processing", "In Processing Tissue"),
           ("unreleased_packaged", "Unreleased Packaged Tissue"), ("released_packaged", "Released Packaged Tissue")]
_DC_BOTTOM = [("tissue_discarded_by", "Tissue Discarded By"), ("confirmed_by", "Confirmed By"), ("discard_date", "Date"),
              ("freezerpro_updated_by", "FreezerPro Updated By"), ("freezerpro_date", "Date (Released Packaged Tissue)"),
              ("log_updated_by", "Log / FreezerPro Updated By"), ("log_date", "Date (Unprocessed / In Processing / Unreleased)")]


def no_graft_id(value) -> bool:
    """N/A, a dash, or nothing written all mean 'no graft ID'."""
    if blank(value):
        return True
    text = str(value).strip().upper().replace(" ", "")
    return text in ("N/A", "NA", "N\\A") or set(text) <= set("-—–_")


def _check_one_discard(problems: list, form: dict, page: int):
    top = form.get("top") or {}
    for key, label in (("donor_no", "Donor #"), ("reason", "Reason for Discard")):
        if blank(top.get(key)):
            problems.append(_problem(page, "Top", None, label, "missing", f"{label} is blank.", "dc_top"))
    authorized = top.get("authorized") or {}
    missing = [part for part in ("initials", "date") if blank(authorized.get(part))]
    if missing:
        problems.append(_problem(page, "Top", None, "Discard Authorized By/Date", "missing",
                                 f"Discard Authorized By/Date is missing {' and '.join(missing)}.", "dc_top"))

    status = form.get("status") or {}
    checked = [label for key, label in _STATUS if status.get(key)]
    if not checked:
        problems.append(_problem(page, "Tissue Status", None, "Tissue Status", "missing",
                                 "No Tissue Status box is checked.", "dc_status"))
    elif len(checked) > 1:
        problems.append(_problem(page, "Tissue Status", None, "Tissue Status", "please_check",
                                 f"More than one Tissue Status box is checked: {', '.join(checked)}.", "dc_status"))

    rows = [row for row in form.get("tissues") or [] if not blank(row.get("item"))]
    if not rows:
        problems.append(_problem(page, "Tissue list", None, None, "please_check",
                                 "No listed tissues could be read.", "unread"))
    live = []
    for row in rows:
        if row.get("crossed_out"):
            _crossed(problems, row, page, "Tissue list")
            continue
        live.append(row)
        if not row.get("x_marked"):
            problems.append(_problem(page, "Tissue list", row.get("item"), "X box", "missing",
                                     f"The X box is not marked for \"{row.get('item')}\".", "dc_x", row.get("row_number")))

    if len(checked) == 1 and live:
        graft_ids = [row.get("graft_id") for row in live if not no_graft_id(row.get("graft_id"))]
        packaged = checked[0] in ("Unreleased Packaged Tissue", "Released Packaged Tissue")
        if graft_ids and not packaged:
            problems.append(_problem(page, "Tissue Status", None, "Tissue Status", "inconsistent",
                                     f"Graft ID {graft_ids[0]} is listed, but Tissue Status is \"{checked[0]}\". "
                                     "It should be Unreleased or Released Packaged Tissue.", "dc_graft"))
        if not graft_ids and packaged:
            problems.append(_problem(page, "Tissue Status", None, "Tissue Status", "inconsistent",
                                     f"Graft IDs are N/A, but Tissue Status is \"{checked[0]}\". "
                                     "It should be Unprocessed or In Processing Tissue.", "dc_na"))

    bottom = form.get("bottom") or {}
    for key, label in _DC_BOTTOM:
        if blank(bottom.get(key)):
            problems.append(_problem(page, "Bottom", None, label, "missing", f"{label} is blank.", "dc_bottom"))


def _check_discard(data: dict) -> list:
    problems = []
    for number, form in enumerate(data.get("forms") or [], start=1):
        _check_one_discard(problems, form, form.get("page") or number)
    return problems


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
_CHECKERS = {"MP-F-023": _check_mp_f_023, "QS-F-049": _check_qs_f_049, "LOT_LOG": _check_lot_log,
             "DISCARD": _check_discard}
_ORDER = {"missing": 0, "wrong_format": 1, "inconsistent": 1, "please_check": 2, "extra_note": 3}
ERROR_KINDS = ("missing", "wrong_format", "inconsistent")


def check_form(form_type: str, data: dict) -> list:
    """All problems found on the form, most serious first. Empty list = passed every check."""
    if form_type not in _CHECKERS:
        raise ValueError(f"Unknown form type {form_type!r}.")
    problems = _CHECKERS[form_type](data or {})

    # Boxes the AI wasn't sure about -> ask a person to look
    for u in (data or {}).get("unsure") or []:
        problems.append(_problem(u.get("page"), u.get("section"), u.get("row"), u.get("field"), "please_check",
                                 f"{u.get('field')}: {u.get('note', 'please check this box.')}", "unsure",
                                 u.get("row_number")))

    return sorted(problems, key=lambda p: (_ORDER.get(p["kind"], 9), p.get("page") or 0))


def count(problems: list) -> dict:
    """How many problems of each kind: {"errors": 2, "please_check": 1, "extra_notes": 0}."""
    return {"errors": sum(p["kind"] in ERROR_KINDS for p in problems),
            "please_check": sum(p["kind"] == "please_check" for p in problems),
            "extra_notes": sum(p["kind"] == "extra_note" for p in problems)}
