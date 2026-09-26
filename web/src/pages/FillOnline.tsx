import { useState } from 'react';
import { CircleCheck, FileText, History, PenLine, Printer } from 'lucide-react';
import { DiscardForm } from '../components/online/DiscardForm';
import { LotLogForm } from '../components/online/LotLogForm';
import { MPF023Form } from '../components/online/MPF023Form';
import { PrintSheet, type PrintSection } from '../components/online/PrintSheet';
import { QSF049Form } from '../components/online/QSF049Form';
import type { Page } from '../components/Sidebar';
import { FORM_RULES, formLabel, formTitle } from '../lib/formRules';
import type { FormType, ReviewResult } from '../lib/types';

interface Props {
  onSubmitted: (r: ReviewResult) => void;
  onNavigate: (p: Page) => void;
}

export function FillOnline({ onSubmitted, onNavigate }: Props) {
  const [form, setForm] = useState<FormType | null>(null);
  const [done, setDone] = useState<{ result: ReviewResult; sections: PrintSection[] } | null>(null);

  const handleSubmit = (result: ReviewResult, sections: PrintSection[]) => {
    onSubmitted(result);
    setDone({ result, sections });
    setForm(null);
  };
  const back = () => setForm(null);

  if (done) {
    const { result } = done;
    const warnings = result.issues.length;
    return (
      <div className="fade-in">
        <div className="card submitted no-print">
          <div className="pass-icon">
            <CircleCheck size={36} />
          </div>
          <div className="submitted-text">
            <h2>Submitted for review</h2>
            <p>
              {formLabel(result.formType)}
              {result.donorId ? ` for donor ${result.donorId}` : ''} passed every check
              {warnings ? ` (${warnings} item${warnings === 1 ? '' : 's'} flagged to confirm)` : ''} and was added to History.
            </p>
          </div>
          <div className="result-actions">
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Print / Save as PDF
            </button>
            <button className="btn btn-ghost" onClick={() => setDone(null)}>
              <PenLine size={16} /> Fill another form
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('history')}>
              <History size={16} /> View History
            </button>
          </div>
        </div>
        <PrintSheet
          code={result.formRevision ?? formLabel(result.formType)}
          title={formTitle(result.formType)}
          submittedAt={result.reviewedAt}
          sections={done.sections}
        />
      </div>
    );
  }

  if (form === 'MP-F-023') return <MPF023Form onSubmit={handleSubmit} onBack={back} />;
  if (form === 'QS-F-049') return <QSF049Form onSubmit={handleSubmit} onBack={back} />;
  if (form === 'LOT_LOG') return <LotLogForm onSubmit={handleSubmit} onBack={back} />;
  if (form === 'DISCARD') return <DiscardForm onSubmit={handleSubmit} onBack={back} />;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Fill a form online</h1>
          <div className="page-sub">
            Complete a form digitally with live checks, instead of uploading a scan. Choose a form to start.
          </div>
        </div>
      </div>
      <div className="card">
        <div className="forms-strip">
          {FORM_RULES.map((f) => (
            <button key={f.type} className="form-tile" onClick={() => setForm(f.type)}>
              <span className="tile-icon">
                <FileText size={20} />
              </span>
              <span className="tile-code">{f.code}</span>
              <span className="tile-desc">{f.title}</span>
              <span className="tile-foot">{f.rules.length} live checks</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
