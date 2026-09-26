import { useEffect, useRef, useState } from 'react';
import {
  Check, CircleAlert, CircleCheck, CircleX, CloudUpload, Copy, Download, FileQuestion, FileText, Info, Loader2,
  PenLine, RotateCcw, TriangleAlert,
} from 'lucide-react';
import { IssueList } from '../components/IssueList';
import { checkPdf, correctionNote, toReviewResult } from '../lib/api';
import type { ReviewResult } from '../lib/types';

interface Props {
  result: ReviewResult | null;
  onResult: (r: ReviewResult) => void;
  onReset: () => void;
}

const STEPS = ['Reading the scanned PDF', 'Detecting the form type', 'Applying form-specific rules', 'Preparing the report'];
const STEP_MS = 7000; // 4 steps ≈ 25 s, the typical check time
const MAX_MB = 20;
const TITLE = 'RegenMed Form Checker';
const INTRO = "Catches missing initials, signatures, dates and other routine errors on RegenMed's hand-filled forms before review.";
const HOW_TO =
  "Upload one PDF of an MP-F-023, QS-F-049, Lot Log or Discard Form. You don't need to say which. Results take about 20 to 30 seconds.";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function Review({ result, onResult, onReset }: Props) {
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [step, setStep] = useState(0);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    setSlow(false);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS);
    const w = setTimeout(() => setSlow(true), 20000);
    return () => {
      clearInterval(t);
      clearTimeout(w);
    };
  }, [busy]);

  useEffect(() => setActiveId(null), [result]);

  async function handleFiles(files: FileList | null | undefined) {
    if (!files || !files.length || busy) return;
    setError(null);
    if (files.length > 1) {
      setError('Please upload one PDF at a time.');
      return;
    }
    const f = files[0];
    setFileName(f.name);
    if (!f.name.toLowerCase().endsWith('.pdf') || (f.type && f.type !== 'application/pdf')) {
      setError('Please upload a PDF file.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_MB} MB. Please upload a smaller PDF.`);
      return;
    }
    setBusy(true);
    try {
      onResult(toReviewResult(await checkPdf(f), f));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // ---------- Processing state
  if (busy) {
    return (
      <div className="fade-in">
        <Header title={TITLE} sub={fileName ?? ''} />
        <div className="card processing" role="status" aria-live="polite">
          <div className="steps">
            <p className="checking-msg">
              Checking your form… this takes about 20 to 30 seconds.
              {slow && <span className="checking-slow">Waking up the server, almost there…</span>}
            </p>
            {STEPS.map((s, i) => (
              <div key={s} className={`step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                <span className="step-dot">
                  {i < step ? <CircleCheck size={16} /> : i === step ? <Loader2 size={16} className="spin" /> : i + 1}
                </span>
                {s}
              </div>
            ))}
          </div>
          <div className="scan-preview">
            <div className="scan-line" />
            <CloudUpload size={48} color="var(--primary)" opacity={0.35} />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Result state
  if (result) {
    const check = result.check;

    if (result.formType === 'UNKNOWN') {
      return (
        <div className="fade-in">
          <Header title={TITLE} sub={result.fileName} />
          <div className="card unknown-box">
            <div className="verdict-icon verdict-warn">
              <FileQuestion size={32} />
            </div>
            <p>
              This doesn't look like one of the 4 RegenMed forms (MP-F-023, QS-F-049, Lot Log or Discard Form). Please
              upload one of those.
            </p>
            <button className="btn btn-primary" onClick={onReset}>
              <RotateCcw size={16} /> Check another form
            </button>
          </div>
        </div>
      );
    }

    const errors = check?.counts.errors ?? result.issues.filter((i) => i.severity === 'error').length;
    const toCheck = check?.counts.please_check ?? result.issues.filter((i) => i.severity === 'warning').length;
    const notes = check?.counts.extra_notes ?? result.issues.filter((i) => i.severity === 'note').length;
    const verdict = !result.passed ? 'fail' : toCheck ? 'warn' : 'pass';
    const VerdictIcon = verdict === 'fail' ? CircleX : CircleCheck;
    const showPerPage = result.formType === 'DISCARD' && check && check.pages.length > 1;

    const jumpTo = (id: string) => {
      setActiveId(id);
      const issue = result.issues.find((i) => i.id === id);
      if (issue) document.getElementById(`page-${issue.page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
      <div className="fade-in">
        <Header title={TITLE} sub={result.fileName} />

        <div className="card">
          <div className="result-summary">
            <div className={`verdict-icon verdict-${verdict}`} aria-hidden="true">
              <VerdictIcon size={32} />
            </div>
            <div className="result-main">
              <span className="badge badge-blue">{check?.form_name ?? result.formType}</span>
              <h2 className={`verdict-text verdict-text-${verdict}`}>
                {verdict === 'pass'
                  ? 'Passed all checks'
                  : verdict === 'warn'
                    ? `Passed all required checks. ${plural(toCheck, 'item needs', 'items need')} a quick look`
                    : `${plural(errors, 'problem')} found`}
              </h2>
              <div className="counters">
                <span className="badge badge-red">
                  <CircleAlert size={12} /> Problems {errors}
                </span>
                <span className="badge badge-amber">
                  <TriangleAlert size={12} /> Please check {toCheck}
                </span>
                <span className="badge badge-grey">
                  <Info size={12} /> Extra notes {notes}
                </span>
              </div>
            </div>
            <div className="result-actions">
              <button className="btn btn-ghost" onClick={() => downloadReport(result)}>
                <Download size={16} /> Report
              </button>
              <button className="btn btn-primary" onClick={onReset}>
                <RotateCcw size={16} /> Check another form
              </button>
            </div>
          </div>

          {showPerPage && (
            <div className="per-page-wrap">
              <h3 className="card-title">Results per form</h3>
              <ul className="per-page">
                {check.per_page.map((p) => (
                  <li key={p.page}>
                    <b>Page {p.page}</b>
                    {!p.errors && !p.please_check ? (
                      <span className="pp pp-pass">
                        · <CircleCheck size={14} /> Passed
                      </span>
                    ) : (
                      <>
                        {p.errors > 0 && (
                          <span className="pp pp-fail">
                            · <CircleX size={14} /> {plural(p.errors, 'problem')}
                          </span>
                        )}
                        {p.please_check > 0 && (
                          <span className="pp pp-warn">
                            · <TriangleAlert size={14} /> {p.please_check} to check
                          </span>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {check && (errors > 0 || toCheck > 0) && <CorrectionNote check={check} />}
        </div>

        <div className="result-grid">
          <div className="card preview">
            <div className="card-head">
              <h3 className="card-title">Form preview</h3>
              <span className="muted small">Click a problem to jump to its page</span>
            </div>
            {check?.pages.length ? (
              <div className="preview-pages">
                {check.pages.map((src, i) => (
                  <figure className="page-wrap" id={`page-${i + 1}`} key={i}>
                    <img src={src} alt={`Page ${i + 1} of ${result.fileName}`} />
                    <figcaption className="page-tag">Page {i + 1}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="preview-empty">
                <FileText size={28} />
                <div>No preview available.</div>
              </div>
            )}
          </div>
          <div className="card">
            <IssueList issues={result.issues} activeId={activeId} groupBy="severity" onSelect={jumpTo} />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Upload state
  return (
    <div className="fade-in">
      <Header title={TITLE} sub={INTRO} />
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="dz-icon">
          <CloudUpload size={36} />
        </div>
        <div className="dz-title">Drop a PDF here</div>
        <div className="dz-sub">{HOW_TO}</div>
        <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
          Choose PDF
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {fileName && <div className="dz-file">{fileName}</div>}
        <div className="dz-chips">
          <span className="badge badge-grey">MP-F-023</span>
          <span className="badge badge-grey">QS-F-049</span>
          <span className="badge badge-grey">Lot Log</span>
          <span className="badge badge-grey">Discard Form</span>
          <span className="badge badge-grey">PDF · 1 file · max {MAX_MB} MB</span>
        </div>
        {error && (
          <div className="error-box" role="alert">
            <CircleAlert size={16} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}

function CorrectionNote({ check }: { check: NonNullable<ReviewResult['check']> }) {
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function write() {
    setLoading(true);
    setError(null);
    try {
      setNote(await correctionNote(check));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Please select the text and copy it.");
    }
  }

  return (
    <div className="note-box">
      {!note && (
        <button className="btn btn-ghost" onClick={write} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <PenLine size={16} />}
          {loading ? 'Writing note…' : 'Write correction note'}
        </button>
      )}
      {note && (
        <>
          <div className="note-head">
            <b>Correction note</b>
            <button className="btn btn-ghost" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="note-text">{note}</pre>
        </>
      )}
      {error && (
        <div className="error-box" role="alert">
          <CircleAlert size={16} /> {error}
        </div>
      )}
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        <div className="page-sub">{sub}</div>
      </div>
    </div>
  );
}

const KIND_LABEL = { error: 'PROBLEM', warning: 'PLEASE CHECK', note: 'EXTRA NOTE' } as const;

function downloadReport(r: ReviewResult) {
  const c = r.check;
  const lines = [
    TITLE,
    `File: ${r.fileName}`,
    `Form: ${c?.form_name ?? r.formType}`,
    `Checked: ${new Date(r.reviewedAt).toLocaleString()}`,
    `Result: ${r.passed ? 'PASSED' : 'NEEDS CORRECTION'}`,
    c ? `Problems: ${c.counts.errors} · Please check: ${c.counts.please_check} · Extra notes: ${c.counts.extra_notes}` : '',
    '',
    ...(r.issues.length
      ? r.issues.map(
          (i, n) =>
            `${n + 1}. [${KIND_LABEL[i.severity]}] ${[`Page ${i.page}`, i.section, i.field].filter(Boolean).join(' · ')}\n   ${i.message}${i.rule ? `\n   Why: ${i.rule}` : ''}`,
        )
      : ['No problems found.']),
  ].filter((l) => l !== '');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${r.fileName.replace(/\.pdf$/i, '')}-check.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}
