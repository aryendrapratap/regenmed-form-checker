import { Trash2 } from 'lucide-react';
import { formLabel } from '../lib/formRules';
import type { ReviewResult } from '../lib/types';

interface Props {
  history: ReviewResult[];
  onOpen: (r: ReviewResult) => void;
  onClear: () => void;
}

export function HistoryPage({ history, onOpen, onClear }: Props) {
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">History</h1>
          <div className="page-sub">Forms reviewed in this session. Click a row to reopen its results.</div>
        </div>
        {history.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (window.confirm('Clear all reviewed forms from this session?')) onClear();
            }}
          >
            <Trash2 size={16} /> Clear history
          </button>
        )}
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Form type</th>
              <th>Reviewed</th>
              <th>Issues</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)}>
                <td>
                  {r.fileName}
                  <span className="badge badge-grey src-badge">{r.source === 'online' ? 'Filled online' : 'Scanned PDF'}</span>
                </td>
                <td>
                  <span className="badge badge-blue">{formLabel(r.formType)}</span>
                </td>
                <td className="muted">{new Date(r.reviewedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td>{r.issues.length}</td>
                <td>
                  <span className={`badge ${r.passed ? 'badge-green' : 'badge-red'}`}>
                    {r.passed ? 'Passed' : 'Needs correction'}
                  </span>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', cursor: 'default' }}>
                  No forms checked yet. Upload one to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
