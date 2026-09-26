import { emptyMPF023, emptyMPRow, MP_PRESET_ROWS, type MPF023Data } from '../../lib/rules';
import type { ReviewResult } from '../../lib/types';
import { exampleMPF023 } from './examples';
import { ChoiceGroup, FormField } from './FormField';
import { FormShell } from './FormShell';
import { InitialsDateField } from './InitialsDateField';
import { printByDate, type PrintSection } from './PrintSheet';
import { RowTable } from './RowTable';

const SIDE_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export function mpf023Print(d: MPF023Data): PrintSection[] {
  const h = d.header;
  return [
    {
      title: 'Header',
      kind: 'kv',
      items: [
        ['Donor #', h.donorNumber],
        ['Verified By', h.verifiedByInitials],
        ['Cross Reference #', h.crossReference],
        ['Donor Sex', h.donorSex],
        ['Donor Age', h.donorAge],
        ['Date of Recovery', h.recoveryDate],
        ['Instruction Verification', h.instructionVerificationInitials],
        ['Date of Processing', h.processingDate],
        ['Clean Room Log Review', printByDate(h.cleanRoomLogReviewInitials, h.cleanRoomLogReviewDate)],
        ['Tissue Checked In', printByDate(h.tissueCheckedInInitials, h.tissueCheckedInDate)],
      ],
    },
    {
      title: 'Labels',
      kind: 'table',
      head: ['Label', 'TGLN#', 'RegenMed ID', 'Side'],
      rows: d.labels.map((l, i) => [String(i + 1), l.tglnNumber, l.regenmedId, l.side === 'left' ? 'Left' : l.side === 'right' ? 'Right' : '']),
    },
    {
      title: 'Special Instructions & Operations Manager Review',
      kind: 'kv',
      items: [
        ['Special Instructions', d.specialInstructions],
        ['Operations Manager Review', printByDate(d.opsReview.initials, d.opsReview.date)],
      ],
    },
    {
      title: 'Processing Instructions',
      kind: 'table',
      head: ['Tissue', 'FRZ/FD', 'Irradiated', 'Comments', '# Produced', '# Packaged'],
      rows: d.rows
        .filter((r) => r.description.trim())
        .map((r) => [
          r.voided ? `${r.description} (VOIDED)` : r.description,
          r.frzFd,
          r.irradiated,
          r.comments,
          r.produced,
          r.packaged,
        ]),
    },
  ];
}

interface Props {
  onSubmit: (result: ReviewResult, sections: PrintSection[]) => void;
  onBack: () => void;
}

export function MPF023Form({ onSubmit, onBack }: Props) {
  return (
    <FormShell
      formType="MP-F-023"
      empty={emptyMPF023}
      example={exampleMPF023}
      donorKey="header.donorNumber"
      print={mpf023Print}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <section className="card form-section">
        <h3 className="card-title">Header</h3>
        <p className="section-sub">Every field from Donor # through Tissue Checked In must be filled.</p>
        <div className="field-grid">
          <FormField fieldKey="header.donorNumber" label="Donor #" />
          <FormField fieldKey="header.verifiedByInitials" label="Verified By" kind="initials" />
          <FormField fieldKey="header.crossReference" label="Cross Reference #" />
          <FormField fieldKey="header.donorSex" label="Donor Sex" placeholder="M / F" />
          <FormField fieldKey="header.donorAge" label="Donor Age" />
          <FormField fieldKey="header.recoveryDate" label="Date of Recovery" kind="date" />
          <FormField fieldKey="header.instructionVerificationInitials" label="Instruction Verification" kind="initials" />
          <FormField fieldKey="header.processingDate" label="Date of Processing" kind="date" />
          <InitialsDateField
            label="Clean Room Log Review"
            initialsKey="header.cleanRoomLogReviewInitials"
            dateKey="header.cleanRoomLogReviewDate"
          />
          <InitialsDateField
            label="Tissue Checked In"
            initialsKey="header.tissueCheckedInInitials"
            dateKey="header.tissueCheckedInDate"
          />
        </div>
      </section>

      <section className="card form-section">
        <h3 className="card-title">Labels</h3>
        <p className="section-sub">Extra note: TGLN# should match Donor #, and RegenMed ID should match Cross Reference #.</p>
        <div className="label-blocks">
          {[0, 1].map((i) => (
            <div className="label-block" key={i}>
              <div className="label-block-title">Label {i + 1}</div>
              <FormField fieldKey={`labels[${i}].tglnNumber`} label="TGLN#" />
              <FormField fieldKey={`labels[${i}].regenmedId`} label="RegenMed ID" />
              <div className="ff">
                <span className="ff-label">Side</span>
                <ChoiceGroup fieldKey={`labels[${i}].side`} name={`Label ${i + 1} side`} options={SIDE_OPTIONS} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card form-section">
        <h3 className="card-title">Special Instructions</h3>
        <FormField fieldKey="specialInstructions" label="Special Instructions (optional)" kind="textarea" />
      </section>

      <section className="card form-section">
        <h3 className="card-title">Operations Manager Review</h3>
        <div className="field-grid">
          <InitialsDateField label="Operations Manager Review" initialsKey="opsReview.initials" dateKey="opsReview.date" />
        </div>
      </section>

      <section className="card form-section">
        <h3 className="card-title">Processing Instructions</h3>
        <p className="section-sub">
          Enter # Produced and # Packaged for every row; write 0 if none. Mark a row Void if it is crossed out on paper.
        </p>
        <RowTable
          arrayKey="rows"
          nameKey="description"
          newRow={emptyMPRow}
          presetCount={MP_PRESET_ROWS.length}
          minRows={MP_PRESET_ROWS.length}
          columns={[
            { key: 'description', label: 'Tissue', presetReadOnly: true },
            { key: 'frzFd', label: 'FRZ/FD', presetReadOnly: true },
            { key: 'irradiated', label: 'Irradiated', presetReadOnly: true },
            { key: 'comments', label: 'Comments', presetReadOnly: true },
            { key: 'produced', label: '# Produced', placeholder: '0' },
            { key: 'packaged', label: '# Packaged', placeholder: '0' },
          ]}
        />
      </section>
    </FormShell>
  );
}
