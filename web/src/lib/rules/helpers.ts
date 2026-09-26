import type { Issue, Severity } from '../types';

export const isBlank = (v?: string | null) => !v || v.trim() === '';

/** N/A, NA, n/a (spaces allowed around the slash), or a dash / em dash / en dash line. */
export const isNA = (v?: string | null) => !!v && /^(n\s*\/?\s*a|[-–—]+)$/i.test(v.trim());

/**
 * "X or Y must not be blank" rules (# Produced / # Packaged, Lot / Qty Used, Load # / Sterilization Date).
 * true = both fields are required; false = either one is enough. Flip here if the organizers say otherwise.
 */
export const BOTH_REQUIRED = true;

const DATE_RE = /^(\d{2})([/.-])(\d{2})\2(\d{2})$/;

/**
 * MM/DD/YY with "/", "-" or "." as the separator (used consistently), that is also a real calendar date
 * (years read as 20YY). Rejects day-first (29/11/24), ISO (2024-11-29) and month names (Nov 29).
 */
export function isValidMMDDYY(v?: string | null): boolean {
  const m = DATE_RE.exec((v ?? '').trim());
  if (!m) return false;
  const [month, day, year] = [Number(m[1]), Number(m[3]), 2000 + Number(m[4])];
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

export const hasInitialsAndDate = (initials?: string | null, date?: string | null) =>
  !isBlank(initials) && !isNA(initials) && !isBlank(date) && !isNA(date);

/** Explains why a non-blank date isn't a valid MM/DD/YY date. */
export function dateFormatMessage(date: string): string {
  const d = date.trim();
  const m = DATE_RE.exec(d);
  if (m && Number(m[1]) > 12 && Number(m[3]) <= 12) {
    return `"${d}" looks day-first. Write it month first: MM/DD/YY (${m[3]}${m[2]}${m[1]}${m[2]}${m[4]}).`;
  }
  if (m) return `"${d}" is not a real calendar date.`;
  if (/^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}$/.test(d)) return `"${d}" is year-first. Write it as MM/DD/YY.`;
  if (/[a-z]/i.test(d)) return `"${d}" uses a month name or words. Write it as MM/DD/YY.`;
  return `"${d}" is not in MM/DD/YY format.`;
}

/** First number in a loosely written reading: "19.9°C" → 19.9, "33.3%" → 33.3, "008.1 pa" → 8.1. */
export function parseLooseNumber(v?: string | null): number | null {
  const m = /-?\d+(?:[.,]\d+)?/.exec(v ?? '');
  return m ? Number(m[0].replace(',', '.')) : null;
}

interface IssueInput {
  ruleId: string;
  severity?: Severity;
  section: string;
  field: string;
  message: string;
  fieldKey: string;
  page?: number;
  foundValue?: string;
  category?: Issue['category'];
}

/** Builds an Issue with a stable id (rule + field), so the UI can track it across re-validation. */
export const makeIssue = ({ severity = 'error', page = 1, ...rest }: IssueInput): Issue => ({
  id: `${rest.ruleId}:${rest.fieldKey}`,
  severity,
  page,
  ...rest,
});

interface InitialsDateCheck {
  initials: string;
  date: string;
  initialsKey: string;
  dateKey: string;
  /** Human label, e.g. "Row 2 · Technical" */
  label: string;
  section: string;
  /** Rule for a completely blank pair */
  blankRule: string;
  /** Rule for a pair that has only one half */
  pairRule: string;
  /** Accept an explicit N/A (in either half, with the other half blank or N/A) */
  allowNA?: boolean;
  /** When set, a badly formatted date is an error under this rule; otherwise a warning under pairRule */
  dateFormatRule?: string;
  page?: number;
}

/** Shared check for "By/Date" style fields: needs initials AND a date. */
export function checkInitialsDate(c: InitialsDateCheck): Issue[] {
  const { initials: i, date: d, label, section, page } = c;
  const naOrBlank = (v: string) => isNA(v) || isBlank(v);
  if (c.allowNA && (isNA(i) || isNA(d)) && naOrBlank(i) && naOrBlank(d)) return [];

  if (isBlank(i) && isBlank(d)) {
    return [
      makeIssue({
        ruleId: c.blankRule,
        section,
        field: label,
        fieldKey: c.initialsKey,
        page,
        message: `${label} is blank. Enter initials and a date${c.allowNA ? ', or N/A' : ''}.`,
      }),
    ];
  }

  const out: Issue[] = [];
  if (naOrBlank(i)) {
    out.push(
      makeIssue({ ruleId: c.pairRule, section, field: label, fieldKey: c.initialsKey, page, message: `${label} has a date but no initials.` }),
    );
  }
  if (naOrBlank(d)) {
    out.push(
      makeIssue({ ruleId: c.pairRule, section, field: label, fieldKey: c.dateKey, page, message: `${label} has initials but no date.` }),
    );
  } else if (!isValidMMDDYY(d)) {
    out.push(
      c.dateFormatRule
        ? makeIssue({ ruleId: c.dateFormatRule, section, field: label, fieldKey: c.dateKey, page, foundValue: d, message: dateFormatMessage(d) })
        : makeIssue({
            ruleId: c.pairRule,
            severity: 'warning',
            section,
            field: label,
            fieldKey: c.dateKey,
            page,
            foundValue: d,
            message: `Date "${d.trim()}" isn't a complete MM/DD/YY date. Confirm it is correct.`,
          }),
    );
  }
  return out;
}

interface RowCheck<R> {
  rows: R[];
  /** fieldKey of the array, e.g. "p2ItemsRight" */
  arrayKey: string;
  ruleId: string;
  section: string;
  page?: number;
  /** The row's item name; rows without one are ignored */
  name: (row: R) => string;
  fields: [keyof R & string, string][];
  /** "all": every field is required. "pair": an "X or Y" rule, governed by BOTH_REQUIRED */
  mode: 'all' | 'pair';
}

/**
 * Shared table-row check. Rows without an item name are never issues. A voided (crossed out) row is a
 * warning to check, never an error, and its fields are skipped. N/A counts as filled, and so does "0".
 */
export function checkRows<R extends { voided?: boolean }>(c: RowCheck<R>): Issue[] {
  const out: Issue[] = [];
  const { section, page, ruleId } = c;
  c.rows.forEach((row, i) => {
    const name = c.name(row).trim();
    if (!name) return;
    const base = `${c.arrayKey}[${i}]`;
    if (row.voided) {
      out.push(
        makeIssue({
          ruleId,
          severity: 'warning',
          category: 'voided',
          section,
          page,
          field: name,
          fieldKey: `${base}.voided`,
          message: `${name} is marked as voided (crossed out). Please check this was intended; its fields were not checked.`,
        }),
      );
      return;
    }
    const blank = c.fields.filter(([k]) => isBlank(String(row[k] ?? '')));
    if (!blank.length) return;
    if (c.mode === 'pair' && !BOTH_REQUIRED) {
      if (blank.length < c.fields.length) return;
      const [k] = c.fields[0];
      out.push(
        makeIssue({
          ruleId,
          section,
          page,
          field: `${name} · ${c.fields.map(([, l]) => l).join(' / ')}`,
          fieldKey: `${base}.${k}`,
          message: `${c.fields.map(([, l]) => l).join(' or ')} must be filled for ${name}. Write N/A if not used.`,
        }),
      );
      return;
    }
    for (const [k, label] of blank) {
      out.push(
        makeIssue({
          ruleId,
          section,
          page,
          field: `${name} · ${label}`,
          fieldKey: `${base}.${k}`,
          message: `${label} is blank for ${name}. Write N/A if not used.`,
        }),
      );
    }
  });
  return out;
}
