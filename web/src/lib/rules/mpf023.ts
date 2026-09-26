import type { Issue } from '../types';
import { checkInitialsDate, checkRows, isBlank, makeIssue } from './helpers';
import type { MPF023Data } from './models';

type Header = MPF023Data['header'];

/** Single header fields, Donor # through Tissue Checked In, in paper order. */
const TOP_FIELDS: [keyof Header, string][] = [
  ['donorNumber', 'Donor #'],
  ['verifiedByInitials', 'Verified By'],
  ['crossReference', 'Cross Reference #'],
  ['donorSex', 'Donor Sex'],
  ['donorAge', 'Donor Age'],
  ['recoveryDate', 'Date of Recovery'],
  ['instructionVerificationInitials', 'Instruction Verification'],
  ['processingDate', 'Date of Processing'],
];

/** Header By/Date pairs */
const BY_DATES = [
  ['cleanRoomLogReview', 'Clean Room Log Review'],
  ['tissueCheckedIn', 'Tissue Checked In'],
] as const;

/** Compare IDs ignoring case, spaces and dashes. */
const sameId = (a: string, b: string) => a.replace(/[\s-]/g, '').toLowerCase() === b.replace(/[\s-]/g, '').toLowerCase();

/** MP-F-023 MS Processing Instructions / Tissue Open Checklist. */
export function validateMPF023(d: MPF023Data): Issue[] {
  const out: Issue[] = [];
  const h = d.header;

  // MP-TOP-BLANK
  for (const [key, label] of TOP_FIELDS) {
    if (isBlank(h[key])) {
      out.push(makeIssue({ ruleId: 'MP-TOP-BLANK', section: 'Header', field: label, fieldKey: `header.${key}`, message: `${label} is blank.` }));
    }
  }

  // MP-BYDATE: initials AND a valid date (a blank pair is MP-TOP-BLANK)
  for (const [key, label] of BY_DATES) {
    out.push(
      ...checkInitialsDate({
        initials: h[`${key}Initials`],
        date: h[`${key}Date`],
        initialsKey: `header.${key}Initials`,
        dateKey: `header.${key}Date`,
        label,
        section: 'Header',
        blankRule: 'MP-TOP-BLANK',
        pairRule: 'MP-BYDATE',
        dateFormatRule: 'MP-BYDATE',
      }),
    );
  }

  // Extra notes: label IDs should match the header
  d.labels.forEach((l, i) => {
    const section = `Labels · Label ${i + 1}`;
    if (!isBlank(l.tglnNumber) && !isBlank(h.donorNumber) && !sameId(l.tglnNumber, h.donorNumber)) {
      out.push(
        makeIssue({
          ruleId: 'MP-LABEL-IDS',
          severity: 'warning',
          category: 'extra-note',
          section,
          field: `Label ${i + 1} · TGLN#`,
          fieldKey: `labels[${i}].tglnNumber`,
          foundValue: l.tglnNumber.trim(),
          message: `TGLN# ${l.tglnNumber.trim()} doesn't match Donor # ${h.donorNumber.trim()}.`,
        }),
      );
    }
    if (!isBlank(l.regenmedId) && !isBlank(h.crossReference) && !sameId(l.regenmedId, h.crossReference)) {
      out.push(
        makeIssue({
          ruleId: 'MP-LABEL-IDS',
          severity: 'warning',
          category: 'extra-note',
          section,
          field: `Label ${i + 1} · RegenMed ID`,
          fieldKey: `labels[${i}].regenmedId`,
          foundValue: l.regenmedId.trim(),
          message: `RegenMed ID ${l.regenmedId.trim()} doesn't match Cross Reference # ${h.crossReference.trim()}.`,
        }),
      );
    }
  });

  // MP-OPS-REVIEW
  out.push(
    ...checkInitialsDate({
      initials: d.opsReview.initials,
      date: d.opsReview.date,
      initialsKey: 'opsReview.initials',
      dateKey: 'opsReview.date',
      label: 'Operations Manager Review',
      section: 'Operations Manager Review',
      blankRule: 'MP-OPS-REVIEW',
      pairRule: 'MP-OPS-REVIEW',
      dateFormatRule: 'MP-OPS-REVIEW',
    }),
  );

  // MP-PRODUCED: every listed, non-voided white row needs # Produced and # Packaged ("0" counts)
  out.push(
    ...checkRows({
      rows: d.rows.map((r) => (r.shaded ? { ...r, description: '' } : r)),
      arrayKey: 'rows',
      ruleId: 'MP-PRODUCED',
      section: 'Processing Instructions',
      name: (r) => r.description,
      fields: [
        ['produced', '# Produced'],
        ['packaged', '# Packaged'],
      ],
      mode: 'pair',
    }),
  );

  return out;
}
