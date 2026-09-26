"""
app.py  -  Person 3 (the face)

The web page. Run it on your laptop with:   streamlit run app.py
Put it online with Streamlit Community Cloud (share.streamlit.io).
"""

import streamlit as st

import ai
import rules

st.set_page_config(page_title="RegenMed Form Checker", page_icon="📋", layout="wide")

KIND_LABEL = {"missing": "Missing", "wrong_format": "Wrong format", "inconsistent": "Doesn't match",
              "please_check": "Please check", "extra_note": "Extra note"}


@st.cache_data(show_spinner=False, max_entries=20)
def check_pdf(pdf_bytes: bytes):
    """The whole check. Cached by file, so the same PDF never costs Gemini calls twice."""
    pages = rules.pdf_to_pages(pdf_bytes)
    form_type = ai.identify_form(pages)
    if form_type == "UNKNOWN":
        return pages, form_type, None, []
    data = ai.read_form(pages, form_type)
    problems = rules.check_form(form_type, data)
    return pages, form_type, data, problems


@st.cache_data(show_spinner=False, max_entries=20)
def make_note(form_type: str, problems: list) -> str:
    return ai.correction_note(form_type, problems)


def where(p: dict) -> str:
    parts = [f"Page {p['page']}" if p.get("page") else None, p.get("section"), p.get("row")]
    if p.get("row_number") and p.get("row") and not str(p.get("row")).startswith("Item"):
        parts[-1] = f"{p['row']} (row {p['row_number']})"
    return " · ".join(x for x in parts if x)


def as_table(problems: list) -> list:
    return [{"Where": where(p), "Field": p.get("field") or "", "Problem": p["message"],
             "Type": KIND_LABEL.get(p["kind"], p["kind"]), "Rule": p["rule"]} for p in problems]


def text_report(form_type: str, problems: list) -> str:
    lines = [f"RegenMed Form Checker report", f"Form: {ai.FORM_NAMES.get(form_type, form_type)}", ""]
    if not problems:
        lines.append("Passed all checks.")
    for p in problems:
        lines.append(f"[{KIND_LABEL.get(p['kind'], p['kind'])}] {where(p)} - {p['message']}")
    return "\n".join(lines)


def show_results(pdf_bytes: bytes, file_name: str = "form.pdf"):
    try:
        with st.spinner("Checking your form... this usually takes 15 to 30 seconds."):
            pages, form_type, data, problems = check_pdf(pdf_bytes)
    except ValueError as error:
        st.error(f"Couldn't open this file: {error}")
        return
    except ai.GeminiError:
        st.error("The AI service didn't answer. Please try again in a minute.")
        return
    except Exception:
        st.error("Something went wrong while checking this form. Please try again.")
        return

    if form_type == "UNKNOWN":
        st.warning("This doesn't look like one of the 4 RegenMed forms (MP-F-023, QS-F-049, Lot Log or Discard Form). "
                   "Please upload one of those.")
        st.image(pages[0], caption="Page 1", width=500)
        return

    title = ai.FORM_NAMES[form_type]
    if form_type == "DISCARD" and len(pages) > 1:
        title += f" · {len(pages)} forms in this PDF (one per page)"
    st.subheader(title)
    totals = rules.count(problems)
    col1, col2, col3 = st.columns(3)
    col1.metric("Problems", totals["errors"])
    col2.metric("Please check", totals["please_check"])
    col3.metric("Extra notes", totals["extra_notes"])

    errors = [p for p in problems if p["kind"] in rules.ERROR_KINDS]
    checks = [p for p in problems if p["kind"] == "please_check"]
    extras = [p for p in problems if p["kind"] == "extra_note"]

    if not errors and not checks:
        st.success("✅ Passed all checks.")
    elif not errors:
        st.success("✅ Passed all required checks. A few items need a quick look.")
    else:
        st.error(f"❌ {len(errors)} problem{'s' if len(errors) != 1 else ''} found.")

    if form_type == "DISCARD" and len(pages) > 1:
        rows = []
        for number in range(1, len(pages) + 1):
            on_page = [p for p in problems if p.get("page") == number]
            bad = sum(p["kind"] in rules.ERROR_KINDS for p in on_page)
            look = sum(p["kind"] == "please_check" for p in on_page)
            rows.append({"Form": f"Page {number}",
                         "Result": "❌ Problems" if bad else ("⚠️ Please check" if look else "✅ Passed"),
                         "Problems": bad, "Please check": look})
        st.dataframe(rows, hide_index=True)

    if errors:
        st.markdown("#### Problems")
        st.dataframe(as_table(errors), hide_index=True)
    if checks:
        st.markdown("#### ⚠️ Please check")
        st.dataframe(as_table(checks), hide_index=True)
    if extras:
        with st.expander(f"Extra notes ({len(extras)}), beyond the required checks"):
            st.dataframe(as_table(extras), hide_index=True)

    if errors or checks:
        st.markdown("#### Correction note")
        if st.button("Write a correction note for staff"):
            with st.spinner("Writing the note..."):
                st.code(make_note(form_type, errors + checks), language=None, wrap_lines=True)

    st.download_button("Download report (.txt)", text_report(form_type, problems),
                       file_name=file_name.rsplit(".", 1)[0] + "_report.txt")

    st.markdown("#### The form")
    for number, page in enumerate(pages, start=1):
        st.image(page, caption=f"Page {number}", width="stretch")


# ---------------------------------------------------------------------------
# The page
# ---------------------------------------------------------------------------
st.title("📋 RegenMed Form Checker")
st.write("Catches missing initials, signatures, dates and other routine errors on RegenMed's hand-filled forms "
         "before a reviewer sits down, so review time goes to judgment instead of hunting for blanks.")
st.markdown("**How to use:** 1) Upload one PDF of an **MP-F-023**, **QS-F-049**, **Lot Log** or **Discard Form**. "
            "You don't need to say which. 2) Wait about 20 seconds. 3) Read the result: ✅ passed, "
            "❌ problems with the page, section and row, or ⚠️ items to double-check. "
            "4) Optional: write a correction note or download a report.")

uploaded = st.file_uploader("Upload one PDF", type=["pdf"])
if uploaded is not None:
    show_results(uploaded.getvalue(), uploaded.name)

with st.expander("How it works"):
    st.write("1. The AI (Gemini) reads the form code to find the form type.\n"
             "2. It reads every box and table row **twice**. If the two readings disagree about a box, "
             "we ask a person to check it instead of guessing.\n"
             "3. Plain rules, taken from RegenMed's requirements for each form, decide what is missing or wrong.\n"
             "   A PDF with several Discard Forms is checked page by page.\n"
             "4. Every problem shows the page, section, row and field where it is.")
