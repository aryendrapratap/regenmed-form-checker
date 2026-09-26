import type { CheckResult, Issue, ReviewResult, Severity } from './types';

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''; // empty in production = same origin
const FALLBACK = 'Something went wrong. Please try again.';

async function readJson(res: Response) {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new Error((data && typeof data.detail === 'string' && data.detail) || FALLBACK);
  return data;
}

/** Upload one PDF: POST /api/check, multipart field "file". */
export async function checkPdf(file: File): Promise<CheckResult> {
  const body = new FormData();
  body.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${API}/api/check`, { method: 'POST', body });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  return (await readJson(res)) as CheckResult;
}

/** Ask the backend to write a correction note for the form's problems. */
export async function correctionNote(result: CheckResult): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API}/api/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form_type: result.form_type, problems: result.problems }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  return ((await readJson(res)) as { note: string }).note;
}

/** Ping /api/health so a sleeping server starts waking up. Errors are ignored. */
export function wakeServer() {
  fetch(`${API}/api/health`).catch(() => {});
}

const SEVERITY: Record<string, Severity> = { please_check: 'warning', extra_note: 'note' };

/** Map the backend response into the ReviewResult shape the rest of the UI uses. */
export function toReviewResult(check: CheckResult, file: File): ReviewResult {
  const order: Record<Severity, number> = { error: 0, warning: 1, note: 2 };
  const issues: Issue[] = check.problems.map((p, i) => {
    const severity = SEVERITY[p.kind] ?? 'error';
    return {
      id: `p${i}`,
      ruleId: p.kind,
      severity,
      section: p.section,
      field: [p.row, p.field].filter(Boolean).join(' · '),
      message: p.message,
      rule: p.rule,
      page: p.page,
      category: severity === 'note' ? 'extra-note' : undefined,
    };
  });
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.page - b.page);
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    formType: check.form_type,
    confidence: 1,
    pageCount: check.pages.length,
    formCount: check.form_type === 'DISCARD' ? check.per_page.length : undefined,
    checksRun: 0,
    issues,
    passed: check.passed,
    reviewedAt: new Date().toISOString(),
    durationMs: Math.round(check.seconds * 1000),
    source: 'pdf',
    check,
  };
}
