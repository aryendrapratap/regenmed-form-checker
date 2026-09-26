import { createContext, useContext } from 'react';
import type { Issue } from '../../lib/types';

/** What every online field needs: read/write by fieldKey, and the (visible) issue for that key. */
export interface FormCtx {
  get(fieldKey: string): unknown;
  set(fieldKey: string, value: unknown): void;
  /** Visible issue for this field (errors win over warnings), respecting the touched / "Check form" state */
  issueFor(fieldKey: string): Issue | undefined;
  touch(fieldKey: string): void;
}

export const FormContext = createContext<FormCtx | null>(null);

export function useFormCtx(): FormCtx {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('Online form fields must be rendered inside <FormShell>');
  return ctx;
}

/** DOM id for a fieldKey, used to scroll to / focus a field from the issue list. */
export const fieldId = (fieldKey: string) => `fk-${fieldKey.replace(/[^a-zA-Z0-9]+/g, '-')}`;

/** Keeps digits only and inserts slashes: "092524" → "09/25/24". */
export function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)].filter(Boolean).join('/');
}
