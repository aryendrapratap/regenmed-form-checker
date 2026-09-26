interface Props {
  on: boolean;
  onToggle: () => void;
  /** Field name, for the accessible label */
  label: string;
}

/** Small "N/A" switch; when on, the field it belongs to is set to N/A and disabled. */
export function NAToggle({ on, onToggle, label }: Props) {
  return (
    <button
      type="button"
      className={`na-toggle ${on ? 'on' : ''}`}
      aria-pressed={on}
      aria-label={`${label}: not applicable`}
      title={on ? `Clear N/A for ${label}` : `Mark ${label} as N/A`}
      onClick={onToggle}
    >
      N/A
    </button>
  );
}
