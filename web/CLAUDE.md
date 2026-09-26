# Project context for Claude Code

## The challenge (RegenMed hackathon)
Build an **Internal Document Reviewer**: a deployed web app where a user uploads ONE
hand-filled, scanned processing-form PDF. The app must:
1. Detect the form type (not told in advance): MP-F-023, QS-F-049, or Lot Log (2 pages, footer "MP-F-021").
2. Apply that form type's rules.
3. Report each issue clearly, referencing the field/section and where it is on the form — or confirm it passed.
Must generalise to unseen PDFs (no hard-coding to samples) and be deployed online.
Out of scope: validating product codes against RegenMed's reference list.

### Rules
**MP-F-023** (MS Processing Instructions / Tissue Open Checklist)
- No blank fields at top, Donor # through Tissue Checked In By/Date. Every By/Date needs initials AND date.
- Operations Manager Review (middle) needs initials and date.
- # Produced or # Packaged must not be blank for white (non-shaded) rows.

**QS-F-049** (Technical/Quality Review and Disposition Statement)
- Reviewed By/Date (Technical + Quality columns): every row has initials + date, or explicit N/A. Dates MM/DD/YY.
- Item 10: if an INC # is entered, the adjacent Status must be filled.

**Lot Log** (MS Processing & Packaging Lot Log, 2 pages)
- P1 Item section: Lot Number, Exp. Date, Manufacturer not blank (N/A if unused).
- P1 RegenMed Item section: Lot or Qty Used not blank.
- P2 Item section: Load # or Sterilization Date not blank for listed items.
- P2 Packaging section: Lot or Qty Used not blank.

**Discard Form** (Tissue Discard Form, footer "MP-F-018", e.g. MP-F-018.005) — bonus objective
- Header: Donor #, Discard Authorized By/Date and Reason for Discard not blank; Authorized By/Date needs initials AND date.
- Tissue Status: exactly one box checked. Graft ID listed → Unreleased or Released Packaged Tissue;
  Graft IDs N/A (or dashes) → Unprocessed or In Processing Tissue.
- Tissue list: the X box must be marked for every listed tissue.
- Bottom: Tissue Discarded By, Confirmed By, Date, both FreezerPro Updated By fields and their Dates not blank (N/A ok).
- One PDF can contain several Discard Forms (one per page). The backend must classify and validate
  per page, set `formIndex` (1-based) on each issue and `formCount` on the ReviewResult.

## This repo = frontend (done)
React 18 + Vite 5 + TypeScript, plain CSS (tokens in src/styles.css), lucide-react icons,
pdfjs-dist renders the uploaded PDF client-side with issue highlights.
Design reference: docs/design-reference.jpg (soft blue, white rounded cards, icon sidebar).

## API contract (backend must implement)
`POST /api/review` — multipart/form-data, field `file` (PDF) → JSON `ReviewResult`
(see src/lib/types.ts). Issue.bbox is normalised 0–1 relative to page width/height
(x, y = top-left) so highlights line up on the preview. Vite dev server proxies /api to
http://localhost:8000.

## Rule engine (single source of truth)
Rules live only in src/lib/rules/: typed models per form (models.ts; every field has a stable
`fieldKey` path such as `rows[3].qualityInitials` or `tissues[2].xMarked`) and one pure validator per
form (qsf049.ts, discard.ts, mpf023.ts, lotlog.ts; `validate(formType, data)` in index.ts).
Each Issue carries `fieldKey`. Fill Online (src/pages/FillOnline.tsx) runs these validators live.
For PDFs the backend should only EXTRACT fields into these same models, plus a bbox per fieldKey;
the frontend then runs the validators and maps fieldKey → bbox for the highlights. Do not
re-implement the rules in Python. Sanity checks: `npm run test:rules` (scripts/check-rules.ts).

Team-plan interpretations (apply to all forms):
- Dates: month first, MM/DD/YY with "/", "-" or "." (09/25/24, 09-25-24, 11.29.24 all valid). Day-first,
  ISO and month names are rejected.
- "X or Y must not be blank" requires BOTH for now: `BOTH_REQUIRED` in src/lib/rules/helpers.ts.
- Rows without an item name are never issues. "0" and N/A count as filled.
- A voided (crossed-out) row is a warning ("please check"), never an error; its fields are skipped.
- Extra notes (warnings, `category: 'extra-note'`): MP label TGLN# ≠ Donor # / RegenMed ID ≠ Cross Reference #;
  Lot Log Room Temp outside 15–25 °C, RH above 60%, pressure below 4.98 Pa.

## Next steps
- Build the backend (e.g. FastAPI in /backend): PDF → page images → vision LLM
  extracts fields into the models in src/lib/rules/models.ts (with a bbox per fieldKey) → the
  frontend validators above apply the rules (see "Rule engine").
- Set VITE_USE_MOCK=false and VITE_API_URL once deployed.
