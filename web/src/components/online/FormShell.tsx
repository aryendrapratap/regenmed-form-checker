import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronUp, CircleCheck, Eraser, ListChecks, Send, WandSparkles } from 'lucide-react';
import { IssueList } from '../IssueList';
import { FORM_RULES } from '../../lib/formRules';
import { getIn, setIn, validate, type FormDataMap, type ValidatedForm } from '../../lib/rules';
import type { Issue, ReviewResult } from '../../lib/types';
import { FormContext, fieldId, type FormCtx } from './FormContext';
import type { PrintSection } from './PrintSheet';

interface Props<K extends ValidatedForm> {
  formType: K;
  empty: () => FormDataMap[K];
  example: () => FormDataMap[K];
  /** fieldKey holding the donor / DDIN number, used to name the submission */
  donorKey: string;
  print: (data: FormDataMap[K]) => PrintSection[];
  onSubmit: (result: ReviewResult, sections: PrintSection[]) => void;
  onBack: () => void;
  children: ReactNode;
}

const DEBOUNCE_MS = 200;

/** Everything around a digital form: live validation, issue panel, toolbar and submit. */
export function FormShell<K extends ValidatedForm>({ formType, empty, example, donorKey, print, onSubmit, onBack, children }: Props<K>) {
  const info = FORM_RULES.find((f) => f.type === formType)!;
  const [data, setData] = useState<FormDataMap[K]>(empty);
  const [issues, setIssues] = useState<Issue[]>(() => validate(formType, data));
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Live validation, debounced
  useEffect(() => {
    const t = setTimeout(() => setIssues(validate(formType, data)), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [formType, data]);

  // Until "Check form", only show issues on fields the user has touched
  const visible = useMemo(
    () => (showAll ? issues : issues.filter((i) => i.fieldKey && touched.has(i.fieldKey))),
    [issues, touched, showAll],
  );
  const byKey = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of visible) {
      if (i.fieldKey && (!m.has(i.fieldKey) || i.severity === 'error')) m.set(i.fieldKey, i);
    }
    return m;
  }, [visible]);

  const ctx = useMemo<FormCtx>(
    () => ({
      get: (k) => getIn(data, k),
      set: (k, v) => setData((d) => setIn(d, k, v)),
      issueFor: (k) => byKey.get(k),
      touch: (k) => setTouched((s) => (s.has(k) ? s : new Set(s).add(k))),
    }),
    [data, byKey],
  );

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const hidden = issues.length - visible.length;

  function focusIssue(issue: Issue | undefined) {
    if (!issue?.fieldKey) return;
    setActiveId(issue.id);
    setPanelOpen(false);
    const el = document.getElementById(fieldId(issue.fieldKey));
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }

  /** Validate now (skipping the debounce) and reveal everything. */
  function checkNow() {
    const now = validate(formType, data);
    setIssues(now);
    setShowAll(true);
    return now;
  }

  function reset(next: FormDataMap[K], reveal: boolean) {
    setData(next);
    setIssues(validate(formType, next));
    setTouched(new Set());
    setShowAll(reveal);
    setActiveId(null);
  }

  function submit() {
    const now = checkNow();
    if (now.some((i) => i.severity === 'error')) {
      focusIssue(now.find((i) => i.severity === 'error'));
      return;
    }
    const donor = String(getIn(data, donorKey) ?? '').trim();
    const result: ReviewResult = {
      id: crypto.randomUUID(),
      fileName: `${info.code}${donor ? ` · ${donor}` : ''}`,
      formType,
      confidence: 1,
      formRevision: info.code,
      donorId: donor || undefined,
      pageCount: 1,
      checksRun: info.rules.length,
      issues: now,
      passed: true,
      reviewedAt: new Date().toISOString(),
      durationMs: 0,
      source: 'online',
    };
    onSubmit(result, print(data));
  }

  const status = errors ? `${issues.length} issue${issues.length === 1 ? '' : 's'} remaining` : 'Ready for review';

  return (
    <div className="fill-page fade-in">
      <div className="page-head">
        <div>
          <button type="button" className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={14} /> All forms
          </button>
          <h1 className="page-title">{info.code}</h1>
          <div className="page-sub">{info.title} · filled online</div>
        </div>
        <div className="fill-toolbar">
          <button type="button" className="btn btn-ghost" onClick={() => reset(example(), true)}>
            <WandSparkles size={16} /> Load example with errors
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.confirm('Clear every field on this form?') && reset(empty(), false)}
          >
            <Eraser size={16} /> Clear
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => focusIssue(checkNow().find((i) => i.severity === 'error'))}
          >
            <ListChecks size={16} /> Check form
          </button>
          <button type="button" className="btn btn-primary" disabled={errors > 0} onClick={submit}>
            <Send size={16} /> Submit for review
          </button>
        </div>
      </div>

      <div className="fill-grid">
        <FormContext.Provider value={ctx}>
          <form className="fill-form" noValidate onSubmit={(e) => e.preventDefault()}>
            {children}
          </form>
        </FormContext.Provider>

        <aside className={`fill-panel ${panelOpen ? 'open' : ''}`} aria-label="Form check">
          <button
            type="button"
            className="fill-panel-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((o) => !o)}
          >
            <span className={`dot ${errors ? 'dot-red' : 'dot-green'}`} />
            <span className="fill-panel-status">{status}</span>
            <ChevronUp size={18} className="fill-panel-chev" />
          </button>
          <div className="fill-panel-body card">
            {errors === 0 ? (
              <div className="ready-box">
                <CircleCheck size={22} />
                <div>
                  <b>Ready for review</b>
                  <span>
                    {warnings
                      ? `No errors. ${warnings} item${warnings === 1 ? '' : 's'} to confirm before submitting.`
                      : 'All checks pass. You can submit this form.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="panel-count">
                <b>{issues.length}</b>
                <div>
                  <div className="panel-count-label">issue{issues.length === 1 ? '' : 's'} remaining</div>
                  <div className="muted small">
                    {errors} to fix{warnings ? ` · ${warnings} to confirm` : ''}
                  </div>
                </div>
              </div>
            )}
            {hidden > 0 && (
              <p className="panel-hint">
                {visible.length ? `${hidden} more` : `${hidden} issue${hidden === 1 ? '' : 's'}`} will show as you fill in the
                form. Press <b>Check form</b> to see everything now.
              </p>
            )}
            {visible.length > 0 && (
              <IssueList
                issues={visible}
                activeId={activeId}
                showPage={false}
                onSelect={(id) => focusIssue(visible.find((i) => i.id === id))}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
