import { useFormCtx } from './FormContext';
import { FieldInput, FieldMessage } from './FormField';
import { NAToggle } from './NAToggle';

interface Props {
  label: string;
  initialsKey: string;
  dateKey: string;
  /** Show an N/A toggle that fills both halves with N/A */
  na?: boolean;
  className?: string;
}

/** "By/Date" pair: initials + MM/DD/YY date side by side, as on the paper forms. */
export function InitialsDateField({ label, initialsKey, dateKey, na, className = '' }: Props) {
  const { get, set, touch } = useFormCtx();
  const naOn = !!na && get(initialsKey) === 'N/A' && get(dateKey) === 'N/A';

  const toggle = () => {
    set(initialsKey, naOn ? '' : 'N/A');
    set(dateKey, naOn ? '' : 'N/A');
    touch(initialsKey);
    touch(dateKey);
  };

  return (
    <div className={`ff idf ${className}`} role="group" aria-label={label}>
      <span className="ff-label">{label}</span>
      <div className="ff-row">
        <FieldInput fieldKey={initialsKey} kind="initials" ariaLabel={`${label} initials`} disabled={naOn} />
        <FieldInput fieldKey={dateKey} kind="date" ariaLabel={`${label} date`} disabled={naOn} />
        {na && <NAToggle on={naOn} onToggle={toggle} label={label} />}
      </div>
      <FieldMessage fieldKey={initialsKey} />
      <FieldMessage fieldKey={dateKey} />
    </div>
  );
}
