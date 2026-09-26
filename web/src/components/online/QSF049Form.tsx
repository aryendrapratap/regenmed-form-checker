import {
  DISPOSITION_LABELS,
  emptyQSF049,
  type Disposition,
  type QSF049Data,
} from '../../lib/rules';
import type { ReviewResult } from '../../lib/types';
import { exampleQSF049 } from './examples';
import { ChoiceGroup, FormField } from './FormField';
import { FormShell } from './FormShell';
import { InitialsDateField } from './InitialsDateField';
import { printByDate, type PrintSection } from './PrintSheet';

/** Review elements 1–10. Check the wording against the current paper revision of QS-F-049. */
export const QS_ELEMENTS = [
  'Donor eligibility determination is complete and approved.',
  'Recovery documentation is complete and accurate.',
  'Processing records (MP-F-023) are complete and accurate.',
  'Lot Log (MP-F-021): materials and supplies are recorded and within expiry.',
  'Environmental monitoring results for the processing session are acceptable.',
  'Microbiology / culture results are acceptable.',
  'Sterilization records (load #, cycle parameters) are complete and acceptable.',
  'Packaging and labeling were verified against the processing instructions.',
  'Final inspection of the grafts is complete.',
  'QIRs: all incidents (INC #) affecting this donor are recorded with their status.',
];

const DISPOSITION_OPTIONS = (Object.keys(DISPOSITION_LABELS) as Exclude<Disposition, ''>[]).map((value) => ({
  value,
  label: DISPOSITION_LABELS[value],
}));

export function qsf049Print(d: QSF049Data): PrintSection[] {
  return [
    {
      title: 'Header',
      kind: 'kv',
      items: [
        ['RegenMed DDIN #', d.header.ddin],
        ['Cross-Reference #', d.header.crossReference],
        ['Graft ID #s', d.header.graftIds],
      ],
    },
    {
      title: 'Reviewed By/Date',
      kind: 'table',
      head: ['#', 'Review element', 'Technical', 'Quality'],
      rows: d.rows.map((r, i) => [
        String(i + 1),
        i === 9 ? `${QS_ELEMENTS[i]}  INC #: ${d.item10.incNumber || '—'} · Status: ${d.item10.incStatus || '—'}` : QS_ELEMENTS[i],
        printByDate(r.technicalInitials, r.technicalDate),
        printByDate(r.qualityInitials, r.qualityDate),
      ]),
    },
    {
      title: 'Disposition',
      kind: 'kv',
      items: [
        ['Disposition', d.disposition.decision ? DISPOSITION_LABELS[d.disposition.decision] : ''],
        ['QA signature', d.disposition.qaSignature],
        ['Date', d.disposition.qaDate],
      ],
    },
  ];
}

interface Props {
  onSubmit: (result: ReviewResult, sections: PrintSection[]) => void;
  onBack: () => void;
}

export function QSF049Form({ onSubmit, onBack }: Props) {
  return (
    <FormShell
      formType="QS-F-049"
      empty={emptyQSF049}
      example={exampleQSF049}
      donorKey="header.ddin"
      print={qsf049Print}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <section className="card form-section">
        <h3 className="card-title">Header</h3>
        <div className="field-grid">
          <FormField fieldKey="header.ddin" label="RegenMed DDIN #" />
          <FormField fieldKey="header.crossReference" label="Cross-Reference #" />
          <FormField fieldKey="header.graftIds" label="Graft ID #s" className="span-2" />
        </div>
      </section>

      <section className="card form-section">
        <h3 className="card-title">Reviewed By/Date</h3>
        <p className="section-sub">
          Every element needs Technical and Quality initials with a date (MM/DD/YY), or N/A.
        </p>
        <div className="qs-rows">
          {QS_ELEMENTS.map((text, i) => (
            <div className="qs-row" key={i}>
              <span className="qs-num">{i + 1}</span>
              <div className="qs-text">{text}</div>
              <InitialsDateField
                label="Technical"
                initialsKey={`rows[${i}].technicalInitials`}
                dateKey={`rows[${i}].technicalDate`}
                na
              />
              <InitialsDateField
                label="Quality"
                initialsKey={`rows[${i}].qualityInitials`}
                dateKey={`rows[${i}].qualityDate`}
                na
              />
              {i === 9 && (
                <div className="qs-extra">
                  <FormField fieldKey="item10.incNumber" label="INC #" placeholder="e.g. INC-24-117" />
                  <FormField fieldKey="item10.incStatus" label="Status" placeholder="e.g. Open, Closed" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card form-section">
        <h3 className="card-title">Disposition</h3>
        <ChoiceGroup fieldKey="disposition.decision" name="Disposition" options={DISPOSITION_OPTIONS} />
        <div className="field-grid" style={{ marginTop: 18 }}>
          <FormField fieldKey="disposition.qaSignature" label="QA signature (name)" />
          <FormField fieldKey="disposition.qaDate" label="Date" kind="date" />
        </div>
      </section>
    </FormShell>
  );
}
