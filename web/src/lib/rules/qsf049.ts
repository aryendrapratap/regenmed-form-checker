import type { Issue } from '../types';
import { checkInitialsDate, isBlank, isNA, makeIssue } from './helpers';
import type { QSF049Data } from './models';

const COLUMNS = [
  { prefix: 'technical', label: 'Technical' },
  { prefix: 'quality', label: 'Quality' },
] as const;

/** QS-F-049 Technical/Quality Review and Disposition Statement. */
export function validateQSF049(d: QSF049Data): Issue[] {
  const out: Issue[] = [];

  // QS-REVIEWED + QS-DATE-FMT: every row, both columns — initials + MM/DD/YY date, or explicit N/A
  d.rows.forEach((row, i) => {
    for (const { prefix, label } of COLUMNS) {
      out.push(
        ...checkInitialsDate({
          initials: row[`${prefix}Initials`],
          date: row[`${prefix}Date`],
          initialsKey: `rows[${i}].${prefix}Initials`,
          dateKey: `rows[${i}].${prefix}Date`,
          label: `Row ${i + 1} · ${label}`,
          section: 'Reviewed By/Date',
          blankRule: 'QS-REVIEWED',
          pairRule: 'QS-REVIEWED',
          dateFormatRule: 'QS-DATE-FMT',
          allowNA: true,
        }),
      );
    }
  });

  // QS-INC-STATUS: Item 10 — an INC # needs its Status
  const { incNumber, incStatus } = d.item10;
  if (!isBlank(incNumber) && !isNA(incNumber) && isBlank(incStatus)) {
    out.push(
      makeIssue({
        ruleId: 'QS-INC-STATUS',
        section: 'Item 10 — QIRs',
        field: 'Item 10 · Status',
        fieldKey: 'item10.incStatus',
        foundValue: incNumber.trim(),
        message: `INC # ${incNumber.trim()} is entered but its Status is blank.`,
      }),
    );
  }

  return out;
}
