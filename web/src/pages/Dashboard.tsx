import { ChevronRight, FileText, ScanSearch } from 'lucide-react';
import { HeroArt } from '../components/HeroArt';
import { FORM_RULES, formLabel } from '../lib/formRules';
import type { ReviewResult } from '../lib/types';
import type { Page } from '../components/Sidebar';

interface Props {
  history: ReviewResult[];
  onNavigate: (p: Page) => void;
  onOpen: (r: ReviewResult) => void;
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function Dashboard({ history, onNavigate, onOpen }: Props) {
  const total = history.length;
  const passed = history.filter((h) => h.passed).length;
  const allIssues = history.flatMap((h) => h.issues);
  const today = new Date();

  // Real findings across this session's checks
  const findings = [
    { name: 'Problems', val: allIssues.filter((i) => i.severity === 'error').length, color: 'var(--danger)', bg: 'var(--danger-50)' },
    { name: 'Please check', val: allIssues.filter((i) => i.severity === 'warning').length, color: 'var(--warning-ink)', bg: 'var(--warning-50)' },
    { name: 'Extra notes', val: allIssues.filter((i) => i.severity === 'note').length, color: 'var(--ink-2)', bg: 'var(--surface-tint)' },
  ];

  return (
    <div className="dash fade-in">
      {/* Left column — timeline */}
      <section>
        <h1 className="page-title">
          Your
          <br />
          dashboard
        </h1>
        <div className="timeline-label">This session</div>
        <div className="timeline">
          {total === 0 && (
            <div className="tl-item first">
              <span className="dot dot-blue" />
              <span className="tl-name">No forms checked yet. Upload one to start.</span>
            </div>
          )}
          {history.slice(0, 6).map((r, i) => (
            <button key={r.id} className={`tl-item ${i === 0 ? 'highlight' : ''}`} onClick={() => onOpen(r)}>
              <span className={`dot ${r.passed ? 'dot-green' : 'dot-red'}`} />
              <span className="tl-name">{r.fileName}</span>
              <span className="tl-time">{timeOf(r.reviewedAt)}</span>
            </button>
          ))}
          <div className="tl-divider" />
        </div>
        <div className="tl-actions">
          <button className="btn btn-primary btn-block" onClick={() => onNavigate('review')}>
            <ScanSearch size={16} /> Check a form
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => onNavigate('rules')}>
            View form rules
          </button>
        </div>
      </section>

      {/* Right column */}
      <section className="dash-right">
        <div className="dash-top">
          <div className="card stat-card">
            <div className="stat-month">
              {today.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </div>
            <div className="muted small" style={{ fontWeight: 600, marginBottom: 6 }}>
              Forms checked this session
            </div>
            <div className="stat-big">{total}</div>
            {total > 0 && <div className="stat-row">
              <div>
                Passed <b style={{ color: 'var(--success)' }}>{passed}</b>
              </div>
              <div>
                Flagged <b style={{ color: 'var(--danger)' }}>{total - passed}</b>
              </div>
              <div>
                Issues <b>{allIssues.length}</b>
              </div>
            </div>}
            {total === 0 && <div className="muted small">No forms checked yet. Upload one to start.</div>}
          </div>

          <div className="card hero">
            <div className="hero-text">
              <h2>Hello, reviewer!</h2>
              <p>
                Upload a completed processing form and we'll catch the routine misses — blank fields, missing
                initials, date formats — before the two-person review.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => onNavigate('review')}>
                  Upload a form
                </button>
                <button className="btn btn-ghost" onClick={() => onNavigate('fill')}>
                  Fill a form online
                </button>
              </div>
            </div>
            <HeroArt />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Supported forms</h3>
            <button className="link-btn" onClick={() => onNavigate('rules')}>
              All rules <ChevronRight size={14} />
            </button>
          </div>
          <div className="forms-strip">
            {FORM_RULES.map((f, i) => {
              const count = history.filter((h) => h.formType === f.type).length;
              return (
                <button key={f.type} className={`form-tile ${i === 0 ? 'selected' : ''}`} onClick={() => onNavigate('rules')}>
                  <span className="tile-icon">
                    <FileText size={20} />
                  </span>
                  <span className="tile-code">{f.code}</span>
                  <span className="tile-desc">{f.title}</span>
                  <span className="tile-foot">
                    {f.rules.length} checks · {count} reviewed
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="dash-bottom">
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">Findings this session</h3>
            </div>
            {total === 0 ? (
              <div className="dash-empty">No forms checked yet. Upload one to start.</div>
            ) : (
              <div className="reports">
                {findings.map((c) => (
                  <div className="report" key={c.name}>
                    <span className="report-icon" style={{ background: c.bg, color: c.color }}>
                      <FileText size={18} />
                    </span>
                    <div className="report-body">
                      <div className="report-name">{c.name}</div>
                      <b style={{ fontSize: 20 }}>{c.val}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {total > 0 && (
          <p className="muted small">
            Recent forms: {history.slice(0, 3).map((h) => h.check?.form_name ?? formLabel(h.formType)).join(', ')}
          </p>
        )}
      </section>
    </div>
  );
}
