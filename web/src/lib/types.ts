/**
 * Shared result types. The backend's POST /api/check returns a CheckResult,
 * which toReviewResult (src/lib/api.ts) maps into a ReviewResult for the UI.
 */

export type FormType = 'MP-F-023' | 'QS-F-049' | 'LOT_LOG' | 'DISCARD' | 'UNKNOWN';

export type Severity = 'error' | 'warning' | 'note';

/** Normalised bounding box on a page: all values 0–1 relative to page width/height. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Issue {
  id: string;
  /** Rule id from FORM_RULES, e.g. "MP-TOP-BLANK" */
  ruleId: string;
  severity: Severity;
  /** Form section, e.g. "Header", "Operations Manager Review" */
  section: string;
  /** Specific field / row, e.g. "Tissue Checked In By/Date" */
  field: string;
  /** Human-readable explanation */
  message: string;
  /** 1-based page number */
  page: number;
  /** Which form in the PDF this issue belongs to (1-based). A Discard PDF can hold several forms, one per page. */
  formIndex?: number;
  /** Where on the page (optional — enables highlight on the preview) */
  bbox?: BBox;
  /** What the reader extracted from the form, if anything */
  foundValue?: string;
  /** Stable path of the field in the form's data model (src/lib/rules/models.ts), e.g. "rows[3].qualityInitials" */
  fieldKey?: string;
  /** Warning flavour: "extra-note" = advisory check beyond the core rules; "voided" = row crossed out, please check */
  category?: 'extra-note' | 'voided';
  /** The rule behind this issue, shown as grey "Why:" text */
  rule?: string;
}

export interface ReviewResult {
  id: string;
  fileName: string;
  formType: FormType;
  /** 0–1 confidence in the form-type classification */
  confidence: number;
  /** Form revision printed on the form, e.g. "MP-F-023.009" */
  formRevision?: string;
  /** Donor / DDIN / TGLN number if it could be read */
  donorId?: string;
  pageCount: number;
  /** Number of separate forms found in the PDF (Discard PDFs can hold several, one per page) */
  formCount?: number;
  /** Number of rule checks executed */
  checksRun: number;
  issues: Issue[];
  passed: boolean;
  /** ISO timestamp */
  reviewedAt: string;
  /** Milliseconds spent processing */
  durationMs: number;
  /** How the form was submitted; missing means an uploaded (scanned) PDF */
  source?: 'pdf' | 'online';
  /** Raw backend response for uploaded PDFs (page images, counts, per-page summary) */
  check?: CheckResult;
}

// ---------- Backend response: POST /api/check

export type ProblemKind = 'missing' | 'wrong_format' | 'inconsistent' | 'please_check' | 'extra_note';

export interface CheckProblem {
  page: number;
  section: string;
  row: string | null;
  row_number: number | null;
  field: string | null;
  kind: ProblemKind;
  message: string;
  rule: string;
}

export interface CheckResult {
  form_type: FormType;
  form_name: string;
  passed: boolean;
  counts: { errors: number; please_check: number; extra_notes: number };
  problems: CheckProblem[];
  /** One JPEG data URL per page */
  pages: string[];
  per_page: { page: number; errors: number; please_check: number }[];
  seconds: number;
}
