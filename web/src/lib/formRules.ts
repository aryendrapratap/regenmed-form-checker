import type { FormType } from './types';

export interface FormRule {
  id: string;
  section: string;
  text: string;
}

export interface FormInfo {
  type: FormType;
  code: string;
  title: string;
  pages: string;
  rules: FormRule[];
}

/** Rules taken from the RegenMed challenge writeup. */
export const FORM_RULES: FormInfo[] = [
  {
    type: 'MP-F-023',
    code: 'MP-F-023',
    title: 'MS Processing Instructions / Tissue Open Checklist',
    pages: '1 page',
    rules: [
      {
        id: 'MP-TOP-BLANK',
        section: 'Header',
        text: 'No blank header fields, from Donor # through Tissue Checked In.',
      },
      {
        id: 'MP-BYDATE',
        section: 'Header',
        text: 'Every By/Date field (Clean Room Log Review, Tissue Checked In) needs initials and a valid MM/DD/YY date.',
      },
      {
        id: 'MP-OPS-REVIEW',
        section: 'Operations Manager Review',
        text: 'Operations Manager Review needs initials and a valid date.',
      },
      {
        id: 'MP-PRODUCED',
        section: 'Processing Instructions',
        text: 'Every row needs # Produced and # Packaged ("0" counts). Voided rows are flagged to check instead.',
      },
      {
        id: 'MP-LABEL-IDS',
        section: 'Labels (extra note)',
        text: 'Warning only: each label\'s TGLN# should match Donor # and its RegenMed ID should match Cross Reference #.',
      },
    ],
  },
  {
    type: 'QS-F-049',
    code: 'QS-F-049',
    title: 'Technical/Quality Review and Disposition Statement',
    pages: '1 page',
    rules: [
      {
        id: 'QS-REVIEWED',
        section: 'Reviewed By/Date',
        text: 'Every row in the Technical and Quality columns must have initials and a date, or say N/A.',
      },
      {
        id: 'QS-DATE-FMT',
        section: 'Reviewed By/Date',
        text: 'Dates must be month first, MM/DD/YY (slashes, dashes or dots), and a real date.',
      },
      {
        id: 'QS-INC-STATUS',
        section: 'Item 10 — QIRs',
        text: 'If an INC # is entered, the adjacent Status field must also be filled.',
      },
    ],
  },
  {
    type: 'LOT_LOG',
    code: 'Lot Log',
    title: 'MS Processing & Packaging Lot Log',
    pages: '2 pages',
    rules: [
      {
        id: 'LOT-P1-ITEM',
        section: 'Page 1 · Item table',
        text: 'Every listed item needs Lot Number, Exp. Date and Manufacturer. Write N/A if the item was not used.',
      },
      {
        id: 'LOT-P1-REGENMED',
        section: 'Page 1 · RegenMed Item table',
        text: 'Lot and Qty Used must both be filled.',
      },
      {
        id: 'LOT-P2-ITEM',
        section: 'Page 2 · Item tables',
        text: 'Load # and Sterilization Date must both be filled for every listed item.',
      },
      {
        id: 'LOT-P2-PACKAGING',
        section: 'Page 2 · Packaging table',
        text: 'Lot and Qty Used must both be filled.',
      },
      {
        id: 'LOT-ROOM',
        section: 'Page 1 · Room readings (extra note)',
        text: 'Warning only: Room Temp outside 15–25 °C, RH above 60%, or either pressure below 4.98 Pa.',
      },
    ],
  },
  {
    type: 'DISCARD',
    code: 'Discard Form',
    title: 'Tissue Discard Form (MP-F-018)',
    pages: '1 page per form (a PDF may contain several)',
    rules: [
      {
        id: 'DISC-TOP-BLANK',
        section: 'Header',
        text: 'Donor #, Discard Authorized By/Date and Reason for Discard must not be blank.',
      },
      {
        id: 'DISC-AUTH-BYDATE',
        section: 'Header',
        text: 'Discard Authorized By/Date must have both initials and a date.',
      },
      {
        id: 'DISC-STATUS-CHECKED',
        section: 'Tissue Status',
        text: 'Exactly one Tissue Status box must be checked.',
      },
      {
        id: 'DISC-STATUS-GRAFT',
        section: 'Tissue Status',
        text: 'If a Graft ID is listed, the status must be Unreleased Packaged Tissue or Released Packaged Tissue.',
      },
      {
        id: 'DISC-STATUS-NA',
        section: 'Tissue Status',
        text: 'If the Graft IDs are N/A (or dashes), the status must be Unprocessed Tissue or In Processing Tissue.',
      },
      {
        id: 'DISC-X-BOX',
        section: 'Tissue list',
        text: 'The X box must be marked for every listed tissue.',
      },
      {
        id: 'DISC-BOTTOM-BLANK',
        section: 'Bottom section',
        text: 'No bottom field may be blank: Tissue Discarded By, Confirmed By, Date, both FreezerPro Updated By fields and their Dates (N/A is acceptable).',
      },
    ],
  },
];

export const formLabel = (t: FormType) =>
  t === 'LOT_LOG' ? 'Lot Log' : t === 'DISCARD' ? 'Discard Form' : t === 'UNKNOWN' ? 'Unknown form' : t;

export const formTitle = (t: FormType) =>
  FORM_RULES.find((f) => f.type === t)?.title ?? 'Unrecognised document';
