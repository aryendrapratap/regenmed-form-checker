import type { ReactNode } from 'react';
import {
  emptyLotItem,
  emptyLotLog,
  emptyLotQty,
  emptyLotSterile,
  LOT_P1_ITEMS,
  LOT_REGENMED_ITEMS,
  ROOM_LIMITS,
  type LotLogData,
  type LotQtyRow,
  type LotRoomBlock,
  type LotSterileRow,
} from '../../lib/rules';
import type { ReviewResult } from '../../lib/types';
import { exampleLotLog } from './examples';
import { FormField } from './FormField';
import { FormShell } from './FormShell';
import { InitialsDateField } from './InitialsDateField';
import { printByDate, type PrintSection } from './PrintSheet';
import { RowTable, type RowAction } from './RowTable';

const NOT_USED: RowAction = {
  label: 'Not used',
  isOn: (r) => r.lotNumber === 'N/A' && r.expDate === 'N/A' && r.manufacturer === 'N/A',
  apply: (on) => {
    const v = on ? 'N/A' : '';
    return { lotNumber: v, expDate: v, manufacturer: v };
  },
};

const ROOM_FIELDS: [keyof LotRoomBlock, string, 'text' | 'initials' | 'date', string?][] = [
  ['tpmInitials', 'TPM Initials', 'initials'],
  ['date', 'Date', 'date'],
  ['roomNumber', 'Room #', 'text'],
  ['techsInitials', 'Techs Opening Items', 'text', 'Initials, e.g. KS, EW'],
  ['roomTemp', 'Room Temp (°C)', 'text', 'e.g. 19.9°C'],
  ['roomRH', 'Room RH (%)', 'text', 'e.g. 33.3%'],
  ['roomToAntechamber', 'Room→Antechamber (Pa)', 'text', 'e.g. 8.1 Pa'],
  ['antechamberToHallway', 'Antechamber→Hallway (Pa)', 'text', 'e.g. 8.1 Pa'],
];

const roomPrint = (b: LotRoomBlock): [string, string][] =>
  ROOM_FIELDS.map(([k, label]) => [label, b[k]]);
const voidMark = (item: string, voided?: boolean) => (voided ? `${item} (VOIDED)` : item);
const qtyRows = (rows: LotQtyRow[]) => rows.filter((r) => r.item.trim()).map((r) => [voidMark(r.item, r.voided), r.lot, r.qtyUsed]);
const sterileRows = (rows: LotSterileRow[]) =>
  rows.filter((r) => r.item.trim()).map((r) => [voidMark(r.item, r.voided), r.loadNumber, r.sterilizationDate]);

export function lotLogPrint(d: LotLogData): PrintSection[] {
  return [
    { title: 'Page 1 · Header', kind: 'kv', items: [['Donor #', d.header.donorNumber]] },
    {
      title: 'Page 1 · Processing',
      kind: 'kv',
      items: [...roomPrint(d.processing), ['Bandsaw Inspection', printByDate(d.processing.bandsawInitials, d.processing.bandsawDate)]],
    },
    { title: 'Page 1 · Packaging', kind: 'kv', items: roomPrint(d.packaging) },
    {
      title: 'Page 1 · Item table',
      kind: 'table',
      head: ['Item', 'Lot Number', 'Exp. Date', 'Manufacturer'],
      rows: d.p1Items.filter((r) => r.item.trim()).map((r) => [voidMark(r.item, r.voided), r.lotNumber, r.expDate, r.manufacturer]),
    },
    { title: 'Page 1 · RegenMed Item table', kind: 'table', head: ['Item', 'Lot', 'Qty Used'], rows: qtyRows(d.p1RegenMed) },
    {
      title: 'Page 2 · Item table (left)',
      kind: 'table',
      head: ['Item', 'Load #', 'Sterilization Date'],
      rows: sterileRows(d.p2ItemsLeft),
    },
    {
      title: 'Page 2 · Item table (right)',
      kind: 'table',
      head: ['Item', 'Load #', 'Sterilization Date'],
      rows: sterileRows(d.p2ItemsRight),
    },
    { title: 'Page 2 · Packaging table', kind: 'table', head: ['Item', 'Lot', 'Qty Used'], rows: qtyRows(d.p2Packaging) },
  ];
}

function RoomBlock({ blockKey, title, children }: { blockKey: 'processing' | 'packaging'; title: string; children?: ReactNode }) {
  return (
    <section className="card form-section">
      <h3 className="card-title">{title}</h3>
      <p className="section-sub">
        Extra notes flag Room Temp outside {ROOM_LIMITS.tempMin}–{ROOM_LIMITS.tempMax} °C, RH above {ROOM_LIMITS.rhMax}%, and
        pressures below {ROOM_LIMITS.pressureMin} Pa.
      </p>
      <div className="field-grid">
        {ROOM_FIELDS.map(([k, label, kind, placeholder]) => (
          <FormField key={k} fieldKey={`${blockKey}.${k}`} label={label} kind={kind} placeholder={placeholder} />
        ))}
        {children}
      </div>
    </section>
  );
}

const itemCol = (presetReadOnly: boolean) => ({ key: 'item', label: 'Item', presetReadOnly });

interface Props {
  onSubmit: (result: ReviewResult, sections: PrintSection[]) => void;
  onBack: () => void;
}

export function LotLogForm({ onSubmit, onBack }: Props) {
  return (
    <FormShell
      formType="LOT_LOG"
      empty={emptyLotLog}
      example={exampleLotLog}
      donorKey="header.donorNumber"
      print={lotLogPrint}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <div className="form-page-label">Page 1</div>

      <section className="card form-section">
        <h3 className="card-title">Header</h3>
        <div className="field-grid">
          <FormField fieldKey="header.donorNumber" label="Donor #" />
        </div>
      </section>

      <RoomBlock blockKey="processing" title="Processing">
        <InitialsDateField label="Bandsaw Inspection" initialsKey="processing.bandsawInitials" dateKey="processing.bandsawDate" />
      </RoomBlock>
      <RoomBlock blockKey="packaging" title="Packaging" />

      <section className="card form-section">
        <h3 className="card-title">Item table</h3>
        <p className="section-sub">Lot Number, Exp. Date and Manufacturer for every item. Press Not used to fill all three with N/A.</p>
        <RowTable
          arrayKey="p1Items"
          nameKey="item"
          newRow={emptyLotItem}
          presetCount={LOT_P1_ITEMS.length}
          minRows={LOT_P1_ITEMS.length}
          rowAction={NOT_USED}
          columns={[
            itemCol(true),
            { key: 'lotNumber', label: 'Lot Number' },
            { key: 'expDate', label: 'Exp. Date' },
            { key: 'manufacturer', label: 'Manufacturer' },
          ]}
        />
      </section>

      <section className="card form-section">
        <h3 className="card-title">RegenMed Item table</h3>
        <p className="section-sub">Lot and Qty Used for every item.</p>
        <RowTable
          arrayKey="p1RegenMed"
          nameKey="item"
          newRow={emptyLotQty}
          presetCount={LOT_REGENMED_ITEMS.length}
          minRows={LOT_REGENMED_ITEMS.length}
          columns={[itemCol(true), { key: 'lot', label: 'Lot' }, { key: 'qtyUsed', label: 'Qty Used' }]}
        />
      </section>

      <div className="form-page-label">Page 2</div>

      {(['Left', 'Right'] as const).map((side) => (
        <section className="card form-section" key={side}>
          <h3 className="card-title">Item table ({side.toLowerCase()})</h3>
          <p className="section-sub">Load # and Sterilization Date for every listed item. Rows without an item name are ignored.</p>
          <RowTable
            arrayKey={`p2Items${side}`}
            nameKey="item"
            newRow={emptyLotSterile}
            columns={[
              itemCol(false),
              { key: 'loadNumber', label: 'Load #' },
              { key: 'sterilizationDate', label: 'Sterilization Date', kind: 'date' },
            ]}
          />
        </section>
      ))}

      <section className="card form-section">
        <h3 className="card-title">Packaging table</h3>
        <p className="section-sub">Lot and Qty Used for every listed packaging item.</p>
        <RowTable
          arrayKey="p2Packaging"
          nameKey="item"
          newRow={emptyLotQty}
          columns={[itemCol(false), { key: 'lot', label: 'Lot' }, { key: 'qtyUsed', label: 'Qty Used' }]}
        />
      </section>
    </FormShell>
  );
}
