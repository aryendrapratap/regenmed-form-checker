import type { Issue } from '../types';
import { checkInitialsDate, isBlank, isNA, isValidMMDDYY, makeIssue } from './helpers';
import { TISSUE_STATUS_LABELS, type DiscardData, type DiscardTissue, type TissueStatus } from './models';

const PACKAGED: TissueStatus[] = ['unreleasedPackaged', 'releasedPackaged'];

/** A tissue row counts once it names a tissue (Graft ID or description); empty rows are never issues. */
const isListed = (t: DiscardTissue) => !isBlank(t.graftId) || !isBlank(t.description);

const tissueName = (t: DiscardTissue, i: number) =>
  !isBlank(t.description) ? t.description.trim() : !isBlank(t.graftId) ? t.graftId.trim() : `Row ${i + 1}`;

/** Tissue Discard Form (MP-F-018). Validates one form (one page). */
export function validateDiscard(d: DiscardData, page = 1): Issue[] {
  const out: Issue[] = [];
  const { header, bottom } = d;

  // DISC-TOP-BLANK + DISC-AUTH-BYDATE
  if (isBlank(header.donorNumber)) {
    out.push(
      makeIssue({ ruleId: 'DISC-TOP-BLANK', section: 'Header', field: 'Donor #', fieldKey: 'header.donorNumber', page, message: 'Donor # is blank.' }),
    );
  }
  out.push(
    ...checkInitialsDate({
      initials: header.authorizedByInitials,
      date: header.authorizedByDate,
      initialsKey: 'header.authorizedByInitials',
      dateKey: 'header.authorizedByDate',
      label: 'Discard Authorized By/Date',
      section: 'Header',
      blankRule: 'DISC-TOP-BLANK',
      pairRule: 'DISC-AUTH-BYDATE',
      page,
    }),
  );
  if (isBlank(header.reason)) {
    out.push(
      makeIssue({ ruleId: 'DISC-TOP-BLANK', section: 'Header', field: 'Reason for Discard', fieldKey: 'header.reason', page, message: 'Reason for Discard is blank.' }),
    );
  }

  // DISC-STATUS-CHECKED
  const status = d.tissueStatus;
  if (status.length !== 1) {
    out.push(
      makeIssue({
        ruleId: 'DISC-STATUS-CHECKED',
        section: 'Tissue Status',
        field: 'Tissue Status',
        fieldKey: 'tissueStatus',
        page,
        message: status.length ? `${status.length} Tissue Status boxes are checked. Exactly one must be.` : 'No Tissue Status box is checked.',
      }),
    );
  }

  // DISC-STATUS-GRAFT / DISC-STATUS-NA: status must agree with the Graft IDs
  const named = d.tissues.map((t, i) => ({ t, i })).filter(({ t }) => isListed(t));
  // Voided (crossed out) rows: a warning to check, and skipped by every other tissue rule
  for (const { t, i } of named.filter(({ t }) => t.voided)) {
    out.push(
      makeIssue({
        ruleId: 'DISC-X-BOX',
        severity: 'warning',
        category: 'voided',
        section: 'Tissue list',
        field: `Row ${i + 1} · ${tissueName(t, i)}`,
        fieldKey: `tissues[${i}].voided`,
        page,
        message: `${tissueName(t, i)} is marked as voided (crossed out). Please check this was intended; the row was not checked.`,
      }),
    );
  }
  const listed = named.filter(({ t }) => !t.voided);
  if (status.length === 1) {
    const label = TISSUE_STATUS_LABELS[status[0]];
    const packaged = PACKAGED.includes(status[0]);
    const withGraft = listed.find(({ t }) => !isBlank(t.graftId) && !isNA(t.graftId));
    if (withGraft && !packaged) {
      out.push(
        makeIssue({
          ruleId: 'DISC-STATUS-GRAFT',
          section: 'Tissue Status',
          field: 'Tissue Status',
          fieldKey: 'tissueStatus',
          page,
          foundValue: label,
          message: `Graft ID ${withGraft.t.graftId.trim()} is listed, so the status must be Unreleased or Released Packaged Tissue (not ${label}).`,
        }),
      );
    }
    if (listed.length && listed.every(({ t }) => isNA(t.graftId)) && packaged) {
      out.push(
        makeIssue({
          ruleId: 'DISC-STATUS-NA',
          section: 'Tissue Status',
          field: 'Tissue Status',
          fieldKey: 'tissueStatus',
          page,
          foundValue: label,
          message: `Graft IDs are N/A, so the status must be Unprocessed or In Processing Tissue (not ${label}).`,
        }),
      );
    }
  }

  // DISC-X-BOX
  for (const { t, i } of listed) {
    if (!t.xMarked) {
      out.push(
        makeIssue({
          ruleId: 'DISC-X-BOX',
          section: 'Tissue list',
          field: `Row ${i + 1} · X box`,
          fieldKey: `tissues[${i}].xMarked`,
          page,
          message: `X box not marked for ${tissueName(t, i)}.`,
        }),
      );
    }
  }

  // DISC-BOTTOM-BLANK: every bottom field filled (N/A is fine)
  const single: [keyof DiscardData['bottom'], string][] = [
    ['discardedBy', 'Tissue Discarded By'],
    ['confirmedBy', 'Confirmed By'],
    ['date', 'Date'],
  ];
  for (const [key, label] of single) {
    const v = bottom[key];
    if (isBlank(v)) {
      out.push(
        makeIssue({ ruleId: 'DISC-BOTTOM-BLANK', section: 'Bottom section', field: label, fieldKey: `bottom.${key}`, page, message: `${label} is blank. Enter a value or N/A.` }),
      );
    } else if (key === 'date' && !isNA(v) && !isValidMMDDYY(v)) {
      out.push(
        makeIssue({
          ruleId: 'DISC-BOTTOM-BLANK',
          severity: 'warning',
          section: 'Bottom section',
          field: label,
          fieldKey: `bottom.${key}`,
          page,
          foundValue: v,
          message: `Date "${v.trim()}" isn't a complete MM/DD/YY date. Confirm it is correct.`,
        }),
      );
    }
  }
  for (const n of [1, 2] as const) {
    out.push(
      ...checkInitialsDate({
        initials: bottom[`freezerPro${n}Initials`],
        date: bottom[`freezerPro${n}Date`],
        initialsKey: `bottom.freezerPro${n}Initials`,
        dateKey: `bottom.freezerPro${n}Date`,
        label: `FreezerPro Updated By #${n}`,
        section: 'Bottom section',
        blankRule: 'DISC-BOTTOM-BLANK',
        pairRule: 'DISC-BOTTOM-BLANK',
        allowNA: true,
        page,
      }),
    );
  }

  return out;
}
