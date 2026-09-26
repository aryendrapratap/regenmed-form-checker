import { issueTag } from '../IssueList';
import { fieldId, formatDateInput, useFormCtx } from './FormContext';
import { NAToggle } from './NAToggle';

export type FieldKind = 'text' | 'initials' | 'date' | 'textarea';

const severityClass = (s?: string) => (s === 'error' ? 'err' : s === 'warning' ? 'warn' : '');

interface InputProps {
  fieldKey: string;
  /** Accessible name when there is no visible <label> */
  ariaLabel?: string;
  kind?: FieldKind;
  placeholder?: string;
  disabled?: boolean;
}

/** A bare input bound to a fieldKey: value, formatting, error border and touch-on-blur. */
export function FieldInput({ fieldKey, ariaLabel, kind = 'text', placeholder, disabled }: InputProps) {
  const { get, set, issueFor, touch } = useFormCtx();
  const issue = issueFor(fieldKey);
  const id = fieldId(fieldKey);
  const common = {
    id,
    className: `input input-${kind} ${severityClass(issue?.severity)}`,
    value: String(get(fieldKey) ?? ''),
    disabled,
    'aria-label': ariaLabel,
    'aria-invalid': issue?.severity === 'error' || undefined,
    'aria-describedby': issue ? `${id}-msg` : undefined,
    onBlur: () => touch(fieldKey),
  };
  if (kind === 'textarea') {
    return <textarea {...common} rows={3} placeholder={placeholder} onChange={(e) => set(fieldKey, e.target.value)} />;
  }
  return (
    <input
      {...common}
      placeholder={kind === 'date' ? 'MM/DD/YY' : kind === 'initials' ? 'Init.' : placeholder}
      inputMode={kind === 'date' ? 'numeric' : undefined}
      maxLength={kind === 'initials' ? 5 : undefined}
      autoComplete="off"
      onChange={(e) => {
        const v = e.target.value;
        set(fieldKey, kind === 'date' ? formatDateInput(v) : kind === 'initials' ? v.toUpperCase() : v);
      }}
    />
  );
}

/** The small red / amber message under a field. */
export function FieldMessage({ fieldKey }: { fieldKey: string }) {
  const issue = useFormCtx().issueFor(fieldKey);
  if (!issue) return null;
  return (
    <div id={`${fieldId(fieldKey)}-msg`} className={`ff-msg ${issue.severity === 'warning' ? 'warn' : ''}`}>
      {issue.category && <b>{issueTag(issue)}: </b>}
      {issue.message}
    </div>
  );
}

interface FieldProps {
  fieldKey: string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
  /** Show an N/A toggle next to the input */
  na?: boolean;
  className?: string;
}

/** Labelled input + message, optionally with an N/A toggle. */
export function FormField({ fieldKey, label, kind, placeholder, na, className = '' }: FieldProps) {
  const { get, set, touch } = useFormCtx();
  const naOn = !!na && get(fieldKey) === 'N/A';
  return (
    <div className={`ff ${className}`}>
      <label className="ff-label" htmlFor={fieldId(fieldKey)}>
        {label}
      </label>
      <div className="ff-row">
        <FieldInput fieldKey={fieldKey} kind={kind} placeholder={placeholder} disabled={naOn} />
        {na && (
          <NAToggle
            on={naOn}
            label={label}
            onToggle={() => {
              set(fieldKey, naOn ? '' : 'N/A');
              touch(fieldKey);
            }}
          />
        )}
      </div>
      <FieldMessage fieldKey={fieldKey} />
    </div>
  );
}

interface ChoiceProps {
  fieldKey: string;
  name: string;
  options: { value: string; label: string }[];
  /** The model stores the choice as a one-item array (e.g. Discard tissueStatus) instead of a string */
  asArray?: boolean;
}

/** Radio group styled as selectable chips. The first radio carries the fieldKey's id so issues can focus it. */
export function ChoiceGroup({ fieldKey, name, options, asArray }: ChoiceProps) {
  const { get, set, issueFor, touch } = useFormCtx();
  const current = get(fieldKey);
  const isChecked = (v: string) => (asArray ? Array.isArray(current) && current.includes(v) : current === v);
  const issue = issueFor(fieldKey);
  return (
    <div>
      <div className={`choice-group ${severityClass(issue?.severity)}`} role="radiogroup" aria-label={name}>
        {options.map((o, i) => (
          <label key={o.value} className={`choice ${isChecked(o.value) ? 'on' : ''}`}>
            <input
              type="radio"
              id={i === 0 ? fieldId(fieldKey) : undefined}
              name={fieldKey}
              checked={isChecked(o.value)}
              onChange={() => {
                set(fieldKey, asArray ? [o.value] : o.value);
                touch(fieldKey);
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
      <FieldMessage fieldKey={fieldKey} />
    </div>
  );
}
