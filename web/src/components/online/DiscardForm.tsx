import {
  emptyDiscard,
  TISSUE_STATUS_LABELS,
  type DiscardData,
  type TissueStatus,
} from '../../lib/rules';
import type { ReviewResult } from '../../lib/types';
import { exampleDiscard } from './examples';
import { ChoiceGroup, FormField } from './FormField';
import { FormShell } from './FormShell';
import { InitialsDateField } from './InitialsDateField';
import { printByDate, type PrintSection } from './PrintSheet';
import { TissueTable } from './TissueTable';

const STATUS_OPTIONS = (Object.keys(TISSUE_STATUS_LABELS) as TissueStatus[]).map((value) => ({
  value,
  label: TISSUE_STATUS_LABELS[value],
}));

export function discardPrint(d: DiscardData): PrintSection[] {
  const b = d.bottom;
  return [
    {
      title: 'Header',
      kind: 'kv',
      items: [
        ['Donor #', d.header.donorNumber],
        ['Discard Authorized By/Date', printByDate(d.header.authorizedByInitials, d.header.authorizedByDate)],
        ['Reason for Discard', d.header.reason],
      ],
    },
    {
      title: 'Tissue Status',
      kind: 'kv',
      items: [['Status', d.tissueStatus.map((s) => TISSUE_STATUS_LABELS[s]).join(', ')]],
    },
    {
      title: 'Tissues',
      kind: 'table',
      head: ['#', 'Graft ID', 'Tissue Description', 'Storage Location', 'X'],
      rows: d.tissues.map((t, i) => [String(i + 1), t.graftId, t.description, t.storageLocation, t.xMarked ? 'X' : '']),
    },
    {
      title: 'Discard confirmation',
      kind: 'kv',
      items: [
        ['Tissue Discarded By', b.discardedBy],
        ['Confirmed By', b.confirmedBy],
        ['Date', b.date],
        ['FreezerPro Updated By #1', printByDate(b.freezerPro1Initials, b.freezerPro1Date)],
        ['FreezerPro Updated By #2', printByDate(b.freezerPro2Initials, b.freezerPro2Date)],
      ],
    },
  ];
}

interface Props {
  onSubmit: (result: ReviewResult, sections: PrintSection[]) => void;
  onBack: () => void;
}

export function DiscardForm({ onSubmit, onBack }: Props) {
  return (
    <FormShell
      formType="DISCARD"
      empty={emptyDiscard}
      example={exampleDiscard}
      donorKey="header.donorNumber"
      print={discardPrint}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <section className="card form-section">
        <h3 className="card-title">Header</h3>
        <div className="field-grid">
          <FormField fieldKey="header.donorNumber" label="Donor #" />
          <InitialsDateField
            label="Discard Authorized By/Date"
            initialsKey="header.authorizedByInitials"
            dateKey="header.authorizedByDate"
          />
          <FormField fieldKey="header.reason" label="Reason for Discard" className="span-2" />
        </div>
      </section>

      <section className="card form-section">
        <h3 className="card-title">Tissue Status</h3>
        <p className="section-sub">
          Check one. Listed Graft IDs mean packaged tissue; Graft IDs of N/A mean unprocessed or in-processing tissue.
        </p>
        <ChoiceGroup fieldKey="tissueStatus" name="Tissue Status" options={STATUS_OPTIONS} asArray />
      </section>

      <section className="card form-section">
        <h3 className="card-title">Tissues</h3>
        <p className="section-sub">List every discarded tissue and mark its X box. Write N/A for Graft ID if none was assigned.</p>
        <TissueTable />
      </section>

      <section className="card form-section">
        <h3 className="card-title">Discard confirmation</h3>
        <p className="section-sub">No field may be blank. Use N/A where a field does not apply.</p>
        <div className="field-grid">
          <FormField fieldKey="bottom.discardedBy" label="Tissue Discarded By" kind="initials" na />
          <FormField fieldKey="bottom.confirmedBy" label="Confirmed By" kind="initials" na />
          <FormField fieldKey="bottom.date" label="Date" kind="date" na />
          <InitialsDateField
            label="FreezerPro Updated By #1"
            initialsKey="bottom.freezerPro1Initials"
            dateKey="bottom.freezerPro1Date"
            na
          />
          <InitialsDateField
            label="FreezerPro Updated By #2"
            initialsKey="bottom.freezerPro2Initials"
            dateKey="bottom.freezerPro2Date"
            na
          />
        </div>
      </section>
    </FormShell>
  );
}
