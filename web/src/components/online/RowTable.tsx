import { Fragment } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { fieldId, useFormCtx } from './FormContext';
import { FieldInput, FieldMessage, type FieldKind } from './FormField';

export interface RowColumn {
  key: string;
  label: string;
  kind?: Exclude<FieldKind, 'textarea'> | 'checkbox';
  /** Pre-printed value: shown as plain text on preset rows, editable on rows added by hand */
  presetReadOnly?: boolean;
  placeholder?: string;
}

export interface RowAction {
  label: string;
  isOn: (row: Record<string, unknown>) => boolean;
  /** Field values to write when toggling on / off */
  apply: (on: boolean) => Record<string, unknown>;
}

interface Props {
  arrayKey: string;
  columns: RowColumn[];
  /** Column naming the row (used in labels) */
  nameKey: string;
  newRow: () => object;
  /** Rows before this index are pre-printed on the form: fixed names and can't be removed */
  presetCount?: number;
  /** Optional per-row button, e.g. Lot Log "Not used" */
  rowAction?: RowAction;
  /** Smallest number of rows the table keeps */
  minRows?: number;
}

type Row = Record<string, unknown> & { voided?: boolean };

/** Repeatable table rows with a "Voided (crossed out)" toggle each, as used by every item table. */
export function RowTable({ arrayKey, columns, nameKey, newRow, presetCount = 0, rowAction, minRows = 1 }: Props) {
  const { get, set, issueFor, touch } = useFormCtx();
  const rows = (get(arrayKey) as Row[] | undefined) ?? [];
  const colCount = columns.length + 3 + (rowAction ? 1 : 0);

  return (
    <div>
      <div className="tt-wrap">
        <table className="tt">
          <thead>
            <tr>
              <th className="tt-num">#</th>
              {columns.map((c) => (
                <th key={c.key} className={c.kind === 'checkbox' ? 'tt-x' : undefined}>
                  {c.label}
                </th>
              ))}
              {rowAction && <th className="tt-rowact" />}
              <th className="tt-void">Voided</th>
              <th className="tt-act">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const base = `${arrayKey}[${i}]`;
              const preset = i < presetCount;
              const voided = !!row.voided;
              const name = String(row[nameKey] ?? '').trim() || `Row ${i + 1}`;
              const keys = [...columns.map((c) => `${base}.${c.key}`), `${base}.voided`];
              const hasMsg = keys.some((k) => issueFor(k));
              const actionOn = rowAction?.isOn(row) ?? false;
              return (
                <Fragment key={i}>
                  <tr className={voided ? 'voided' : undefined}>
                    <td className="tt-num">{i + 1}</td>
                    {columns.map((c) => {
                      const key = `${base}.${c.key}`;
                      if (c.kind === 'checkbox') {
                        const issue = issueFor(key);
                        return (
                          <td key={c.key} className="tt-x">
                            <label className={`xbox ${issue ? (issue.severity === 'error' ? 'err' : 'warn') : ''}`}>
                              <input
                                type="checkbox"
                                id={fieldId(key)}
                                checked={!!row[c.key]}
                                disabled={voided}
                                aria-label={`${name} ${c.label}`}
                                onChange={(e) => {
                                  set(key, e.target.checked);
                                  touch(key);
                                }}
                              />
                            </label>
                          </td>
                        );
                      }
                      if (preset && c.presetReadOnly) {
                        return (
                          <td key={c.key} className="tt-static">
                            {String(row[c.key] ?? '')}
                          </td>
                        );
                      }
                      return (
                        <td key={c.key}>
                          <FieldInput
                            fieldKey={key}
                            kind={c.kind}
                            placeholder={c.placeholder}
                            ariaLabel={`${name} ${c.label}`}
                            disabled={voided}
                          />
                        </td>
                      );
                    })}
                    {rowAction && (
                      <td className="tt-rowact">
                        <button
                          type="button"
                          className={`na-toggle ${actionOn ? 'on' : ''}`}
                          aria-pressed={actionOn}
                          disabled={voided}
                          onClick={() => {
                            for (const [k, v] of Object.entries(rowAction.apply(!actionOn))) {
                              set(`${base}.${k}`, v);
                              touch(`${base}.${k}`);
                            }
                          }}
                        >
                          {rowAction.label}
                        </button>
                      </td>
                    )}
                    <td className="tt-void">
                      <button
                        type="button"
                        id={fieldId(`${base}.voided`)}
                        className={`na-toggle void-toggle ${voided ? 'on' : ''}`}
                        aria-pressed={voided}
                        aria-label={`${name}: voided (crossed out)`}
                        title="Voided (crossed out)"
                        onClick={() => {
                          set(`${base}.voided`, !voided);
                          touch(`${base}.voided`);
                        }}
                      >
                        Void
                      </button>
                    </td>
                    <td className="tt-act">
                      {!preset && (
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={rows.length <= minRows}
                          aria-label={`Remove ${name}`}
                          title="Remove row"
                          onClick={() => set(arrayKey, rows.filter((_, j) => j !== i))}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {hasMsg && (
                    <tr className="tt-msg">
                      <td />
                      <td colSpan={colCount - 1}>
                        {keys.map((k) => (
                          <FieldMessage key={k} fieldKey={k} />
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(arrayKey, [...rows, newRow()])}>
        <Plus size={15} /> Add row
      </button>
    </div>
  );
}
