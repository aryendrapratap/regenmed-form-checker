import { isBlank, isNA } from '../../lib/rules';

/** A filled form rendered for reading and printing (black and white via the print stylesheet). */

export type PrintSection =
  | { title: string; kind: 'kv'; items: [string, string][] }
  | { title: string; kind: 'table'; head: string[]; rows: string[][] };

interface Props {
  code: string;
  title: string;
  submittedAt: string;
  sections: PrintSection[];
}

/** Initials + date as one printed value, or "N/A". */
export const printByDate = (initials: string, date: string) =>
  isNA(initials) && (isNA(date) || isBlank(date)) ? 'N/A' : [initials, date].filter((v) => !isBlank(v)).join('  ');

const show = (v: string) => (v.trim() ? v : '—');

export function PrintSheet({ code, title, submittedAt, sections }: Props) {
  return (
    <div className="card print-sheet">
      <div className="ps-head">
        <div>
          <div className="ps-org">RegenMed</div>
          <h2 className="ps-title">{title}</h2>
        </div>
        <div className="ps-meta">
          <b>{code}</b>
          <span>Completed online · {new Date(submittedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
      </div>

      {sections.map((s) => (
        <section className="ps-section" key={s.title}>
          <h3>{s.title}</h3>
          {s.kind === 'kv' ? (
            <dl className="ps-kv">
              {s.items.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{show(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <table className="ps-table">
              <thead>
                <tr>
                  {s.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{show(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
