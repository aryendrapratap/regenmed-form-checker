import { useMemo, useState } from 'react';
import { ChevronDown, CircleAlert, CircleCheck, Info, MapPin, TriangleAlert } from 'lucide-react';
import type { Issue, Severity } from '../lib/types';

interface Props {
  issues: Issue[];
  /** Forms in the PDF; when > 1, issues are grouped by form first, then by section */
  formCount?: number;
  activeId: string | null;
  /** Show the "Page N" badge on each issue (off for forms filled online) */
  showPage?: boolean;
  /** "section" (default): grouped by form section. "severity": problems, then please check, then extra notes (collapsed). */
  groupBy?: 'section' | 'severity';
  onSelect: (id: string) => void;
}

type Filter = 'all' | 'error' | 'warning';

/** Short label for an issue's kind, shown as its badge. */
export const issueTag = (i: Issue) =>
  i.severity === 'error'
    ? 'Must fix'
    : i.severity === 'note' || i.category === 'extra-note'
      ? 'Extra note'
      : i.category === 'voided'
        ? 'Please check'
        : 'Please confirm';

const BADGE: Record<Severity, string> = { error: 'badge-red', warning: 'badge-amber', note: 'badge-grey' };
const ICON = { error: CircleAlert, warning: TriangleAlert, note: Info };

type Numbered = { issue: Issue; n: number };

const bySection = (items: Numbered[]) => {
  const m = new Map<string, Numbered[]>();
  items.forEach((v) => m.set(v.issue.section, [...(m.get(v.issue.section) ?? []), v]));
  return [...m.entries()];
};

/** "Page 2 · Item table · Sieve · Load #" */
const location = (i: Issue) => [`Page ${i.page}`, i.section, i.field].filter(Boolean).join(' · ');

export function IssueList({ issues, formCount, activeId, showPage = true, groupBy = 'section', onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const numbered = issues.map((issue, i) => ({ issue, n: i + 1 }));
  const visible = numbered.filter(({ issue }) => filter === 'all' || issue.severity === filter);

  // Multi-form PDFs: [form label, section groups][]; single form: one unlabelled bucket
  const forms = useMemo(() => {
    if (!formCount || formCount < 2) return [['', bySection(visible)] as const];
    const m = new Map<number, Numbered[]>();
    visible.forEach((v) => {
      const f = v.issue.formIndex ?? v.issue.page;
      m.set(f, [...(m.get(f) ?? []), v]);
    });
    return [...m.entries()]
      .sort(([a], [b]) => a - b)
      .map(([f, items]) => {
        const pages = [...new Set(items.map((v) => v.issue.page))].join(', ');
        return [`Form ${f} (page ${pages})`, bySection(items)] as const;
      });
  }, [visible, formCount]);

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  if (!issues.length) {
    return (
      <div className="pass-box">
        <div className="pass-icon">
          <CircleCheck size={36} />
        </div>
        <h3>All checks passed</h3>
        <p>No missing or inconsistent fields were found. The form is ready for the two-person review.</p>
      </div>
    );
  }

  const renderIssue = ({ issue, n }: Numbered) => {
    const Icon = ICON[issue.severity];
    return (
      <button
        key={issue.id}
        className={`issue ${activeId === issue.id ? 'active' : ''}`}
        onClick={() => onSelect(issue.id)}
      >
        <span className={`issue-num ${issue.severity}`}>{n}</span>
        <span className="issue-body">
          <div className="issue-field">{groupBy === 'severity' ? location(issue) : issue.field}</div>
          <div className="issue-msg">{issue.message}</div>
          {issue.rule && <div className="issue-why">Why: {issue.rule}</div>}
          <div className="issue-foot">
            <span className={`badge ${BADGE[issue.severity]}`}>
              <Icon size={12} /> {issueTag(issue)}
            </span>
            {showPage && groupBy !== 'severity' && (
              <span className="badge badge-grey">
                <MapPin size={12} /> Page {issue.page}
              </span>
            )}
            {issue.foundValue && <span className="found">Read: “{issue.foundValue}”</span>}
          </div>
        </span>
      </button>
    );
  };

  if (groupBy === 'severity') {
    const of = (s: Severity) => numbered.filter((v) => v.issue.severity === s);
    const groups: [string, Severity, string, Numbered[]][] = [
      ['Problems', 'error', '', of('error')],
      ['Please check', 'warning', "The AI wasn't sure, or a row was crossed out. A person should look.", of('warning')],
    ];
    const notes = of('note');
    return (
      <div>
        <div className="card-head">
          <h3 className="card-title">What we found</h3>
        </div>
        {groups.map(([title, sev, sub, items]) => {
          if (!items.length) return null;
          const Icon = ICON[sev];
          return (
            <div className="issue-group" key={title}>
              <h4 className={`group-title group-${sev}`}>
                <Icon size={16} /> {title} <span className="badge badge-grey">{items.length}</span>
              </h4>
              {sub && <p className="group-sub">{sub}</p>}
              {items.map(renderIssue)}
            </div>
          );
        })}
        {notes.length > 0 && (
          <details className="issue-group notes-group">
            <summary className="group-title group-note">
              <ChevronDown size={14} className="notes-chev" /> <Info size={16} /> Extra notes{' '}
              <span className="badge badge-grey">{notes.length}</span>
            </summary>
            <p className="group-sub">Optional checks beyond RegenMed's required rules.</p>
            {notes.map(renderIssue)}
          </details>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="card-head">
        <h3 className="card-title">Issues found</h3>
        <div className="filters">
          <button className={`filter ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            All {issues.length}
          </button>
          <button className={`filter ${filter === 'error' ? 'on' : ''}`} onClick={() => setFilter('error')}>
            Errors {errors}
          </button>
          <button className={`filter ${filter === 'warning' ? 'on' : ''}`} onClick={() => setFilter('warning')}>
            Check {warnings}
          </button>
        </div>
      </div>

      {forms.map(([formTitle, groups]) => (
        <div className="form-group" key={formTitle}>
          {formTitle && <div className="form-group-title">{formTitle}</div>}
          {groups.map(([section, items]) => (
            <div className="issue-group" key={section}>
              <div className="group-title">
                {section} <span className="badge badge-grey">{items.length}</span>
              </div>
              {items.map(renderIssue)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
