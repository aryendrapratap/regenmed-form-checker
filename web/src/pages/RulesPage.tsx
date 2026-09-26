import { FileText } from 'lucide-react';
import { FORM_RULES } from '../lib/formRules';

export function RulesPage() {
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Form rules</h1>
          <div className="page-sub">What the reviewer checks on each form type.</div>
        </div>
      </div>
      <div className="rules-grid">
        {FORM_RULES.map((f) => (
          <div className="card" key={f.type}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
              <span className="tile-icon">
                <FileText size={20} />
              </span>
              <div>
                <div className="card-title">{f.code}</div>
                <div className="muted small">
                  {f.title} · {f.pages}
                </div>
              </div>
            </div>
            {f.rules.map((r) => (
              <div className="rule" key={r.id}>
                <div>
                  <div className="rule-sec">{r.section}</div>
                  <div className="rule-text">{r.text}</div>
                  <div className="rule-id">{r.id}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
