import type { Issue } from '../types';
import { checkRows, isBlank, makeIssue, parseLooseNumber } from './helpers';
import type { LotLogData, LotRoomBlock } from './models';

/** Extra-note limits for the room readings */
export const ROOM_LIMITS = { tempMin: 15, tempMax: 25, rhMax: 60, pressureMin: 4.98 };

function roomNotes(block: LotRoomBlock, key: 'processing' | 'packaging', name: string): Issue[] {
  const out: Issue[] = [];
  const section = `Page 1 · ${name}`;
  const note = (field: keyof LotRoomBlock, label: string, message: string) =>
    out.push(
      makeIssue({
        ruleId: 'LOT-ROOM',
        severity: 'warning',
        category: 'extra-note',
        section,
        field: `${name} · ${label}`,
        fieldKey: `${key}.${field}`,
        foundValue: block[field].trim(),
        message,
      }),
    );

  const temp = isBlank(block.roomTemp) ? null : parseLooseNumber(block.roomTemp);
  if (temp !== null && (temp < ROOM_LIMITS.tempMin || temp > ROOM_LIMITS.tempMax)) {
    note('roomTemp', 'Room Temp', `Room Temp ${temp} °C is outside ${ROOM_LIMITS.tempMin}–${ROOM_LIMITS.tempMax} °C.`);
  }
  const rh = isBlank(block.roomRH) ? null : parseLooseNumber(block.roomRH);
  if (rh !== null && rh > ROOM_LIMITS.rhMax) {
    note('roomRH', 'Room RH', `Room RH ${rh}% is above ${ROOM_LIMITS.rhMax}%.`);
  }
  for (const [field, label] of [
    ['roomToAntechamber', 'Room→Antechamber'],
    ['antechamberToHallway', 'Antechamber→Hallway'],
  ] as const) {
    const pa = isBlank(block[field]) ? null : parseLooseNumber(block[field]);
    if (pa !== null && pa < ROOM_LIMITS.pressureMin) {
      note(field, label, `${label} pressure ${pa} Pa is below ${ROOM_LIMITS.pressureMin} Pa.`);
    }
  }
  return out;
}

/** MS Processing & Packaging Lot Log (MP-F-021, 2 pages). */
export function validateLotLog(d: LotLogData): Issue[] {
  const name = (r: { item: string }) => r.item;
  return [
    ...roomNotes(d.processing, 'processing', 'Processing'),
    ...roomNotes(d.packaging, 'packaging', 'Packaging'),
    // LOT-P1-ITEM: all three always required (N/A if not used)
    ...checkRows({
      rows: d.p1Items,
      arrayKey: 'p1Items',
      ruleId: 'LOT-P1-ITEM',
      section: 'Page 1 · Item table',
      page: 1,
      name,
      fields: [
        ['lotNumber', 'Lot Number'],
        ['expDate', 'Exp. Date'],
        ['manufacturer', 'Manufacturer'],
      ],
      mode: 'all',
    }),
    ...checkRows({
      rows: d.p1RegenMed,
      arrayKey: 'p1RegenMed',
      ruleId: 'LOT-P1-REGENMED',
      section: 'Page 1 · RegenMed Item table',
      page: 1,
      name,
      fields: [
        ['lot', 'Lot'],
        ['qtyUsed', 'Qty Used'],
      ],
      mode: 'pair',
    }),
    ...(['Left', 'Right'] as const).flatMap((side) =>
      checkRows({
        rows: d[`p2Items${side}`],
        arrayKey: `p2Items${side}`,
        ruleId: 'LOT-P2-ITEM',
        section: `Page 2 · Item table (${side.toLowerCase()})`,
        page: 2,
        name,
        fields: [
          ['loadNumber', 'Load #'],
          ['sterilizationDate', 'Sterilization Date'],
        ],
        mode: 'pair',
      }),
    ),
    ...checkRows({
      rows: d.p2Packaging,
      arrayKey: 'p2Packaging',
      ruleId: 'LOT-P2-PACKAGING',
      section: 'Page 2 · Packaging table',
      page: 2,
      name,
      fields: [
        ['lot', 'Lot'],
        ['qtyUsed', 'Qty Used'],
      ],
      mode: 'pair',
    }),
  ];
}
