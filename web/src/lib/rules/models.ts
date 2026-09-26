/**
 * Data models for each form type. Both input paths fill these same shapes:
 * - Fill Online: the digital form edits them directly.
 * - PDF upload: the backend extracts the scan into them (with a bbox per fieldKey).
 *
 * A fieldKey is the path of a field inside its model, e.g. "rows[3].qualityInitials",
 * "header.donorNumber" or "tissues[2].xMarked" (see ./path.ts).
 * Values are kept as the raw strings written on the form; "N/A" / dashes are allowed where the rules accept them.
 */

// ------------------------------------------------------------ QS-F-049

export interface QSF049Row {
  technicalInitials: string;
  technicalDate: string;
  qualityInitials: string;
  qualityDate: string;
}

export type Disposition = '' | 'release' | 'doNotRelease' | 'nonTransplant';

export const DISPOSITION_LABELS: Record<Exclude<Disposition, ''>, string> = {
  release: 'Release for Transplantation',
  doNotRelease: 'Do Not Release',
  nonTransplant: 'Release for Non-Transplant',
};

export const QS_ELEMENT_COUNT = 10;

export interface QSF049Data {
  header: { ddin: string; crossReference: string; graftIds: string };
  /** The 10 review elements; rows[0] is item 1 */
  rows: QSF049Row[];
  /** Item 10 — QIRs */
  item10: { incNumber: string; incStatus: string };
  disposition: { decision: Disposition; qaSignature: string; qaDate: string };
}

export const emptyQSF049 = (): QSF049Data => ({
  header: { ddin: '', crossReference: '', graftIds: '' },
  rows: Array.from({ length: QS_ELEMENT_COUNT }, () => ({
    technicalInitials: '',
    technicalDate: '',
    qualityInitials: '',
    qualityDate: '',
  })),
  item10: { incNumber: '', incStatus: '' },
  disposition: { decision: '', qaSignature: '', qaDate: '' },
});

// ------------------------------------------------------------ Discard Form (MP-F-018)

export type TissueStatus = 'unprocessed' | 'inProcessing' | 'unreleasedPackaged' | 'releasedPackaged';

export const TISSUE_STATUS_LABELS: Record<TissueStatus, string> = {
  unprocessed: 'Unprocessed Tissue',
  inProcessing: 'In Processing Tissue',
  unreleasedPackaged: 'Unreleased Packaged Tissue',
  releasedPackaged: 'Released Packaged Tissue',
};

export interface DiscardTissue {
  graftId: string;
  description: string;
  storageLocation: string;
  xMarked: boolean;
  /** Row crossed out on the form */
  voided?: boolean;
}

export interface DiscardData {
  header: { donorNumber: string; authorizedByInitials: string; authorizedByDate: string; reason: string };
  /** Checked Tissue Status boxes. A scan may have none or several; the online form allows one. */
  tissueStatus: TissueStatus[];
  tissues: DiscardTissue[];
  bottom: {
    discardedBy: string;
    confirmedBy: string;
    date: string;
    freezerPro1Initials: string;
    freezerPro1Date: string;
    freezerPro2Initials: string;
    freezerPro2Date: string;
  };
}

export const emptyTissue = (): DiscardTissue => ({ graftId: '', description: '', storageLocation: '', xMarked: false });

export const emptyDiscard = (): DiscardData => ({
  header: { donorNumber: '', authorizedByInitials: '', authorizedByDate: '', reason: '' },
  tissueStatus: [],
  tissues: [emptyTissue()],
  bottom: {
    discardedBy: '',
    confirmedBy: '',
    date: '',
    freezerPro1Initials: '',
    freezerPro1Date: '',
    freezerPro2Initials: '',
    freezerPro2Date: '',
  },
});

// ------------------------------------------------------------ MP-F-023

export type LabelSide = '' | 'left' | 'right';

export interface MPF023Row {
  description: string;
  /** FRZ (frozen) or FD (freeze-dried) */
  frzFd: string;
  irradiated: string;
  comments: string;
  produced: string;
  packaged: string;
  /** Shaded rows on the paper form are exempt from the # Produced / # Packaged rule */
  shaded?: boolean;
  /** Row crossed out on the form */
  voided?: boolean;
}

export interface MPF023Data {
  header: {
    donorNumber: string;
    verifiedByInitials: string;
    crossReference: string;
    donorSex: string;
    donorAge: string;
    recoveryDate: string;
    instructionVerificationInitials: string;
    processingDate: string;
    cleanRoomLogReviewInitials: string;
    cleanRoomLogReviewDate: string;
    tissueCheckedInInitials: string;
    tissueCheckedInDate: string;
  };
  /** The two label blocks */
  labels: { tglnNumber: string; regenmedId: string; side: LabelSide }[];
  specialInstructions: string;
  /** Operations Manager Review (middle of the form) */
  opsReview: { initials: string; date: string };
  /** Processing Instructions table */
  rows: MPF023Row[];
}

/** Pre-printed Processing Instructions rows: [description, FRZ/FD, Irradiated, Comments]. */
export const MP_PRESET_ROWS: [string, string, string, string][] = [
  ['Posterior Tibialis', 'FRZ', 'YES', 'Min. 0.80 cm x 24 cm'],
  ['Anterior Tibialis', 'FRZ', 'YES', 'Min. 0.85 cm x 28 cm'],
  ['Peroneus Longus', 'FRZ', 'YES', 'Min. 0.70 cm x 27 cm'],
  ['Gracilis', 'FRZ', 'YES', 'Min. 0.50 cm x 25 cm'],
  ['Semitendinosus', 'FRZ', 'YES', 'Min. 0.50 cm x 25 cm'],
  ['Patellar Ligament', 'FRZ', 'YES', 'Normal Specs'],
  ['Femoral Head', 'FRZ', 'YES', '≥ 4.7 cm or else cancellous'],
  ['Humeral Head', 'FRZ', 'YES', '≥ 4.5 cm or else cancellous'],
  ['Tri-Cortical Block', 'FD', 'YES', 'Min. W = 3.0–3.4 cm L = ~3.0 cm'],
  ['Cancellous 1-10 mm', 'FRZ', 'YES', '30 cc (5 bags)'],
  ['Cancellous 4-10 mm', 'FRZ', 'YES', 'AMAP 15 cc'],
  ['Cancellous 1-4 mm', 'FRZ', 'YES', 'AMAP 15 cc'],
  ['Cancellous 3-6 mm', 'FD', 'YES', 'AMAP 30 cc'],
  ['Tibia Shaft / Humerus Shaft / Femur Shaft / Fibula Shaft', 'FRZ', 'NO', 'Follow steps for CellRight'],
];

export const emptyMPRow = (): MPF023Row => ({
  description: '',
  frzFd: '',
  irradiated: '',
  comments: '',
  produced: '',
  packaged: '',
});

export const emptyMPF023 = (): MPF023Data => ({
  header: {
    donorNumber: '',
    verifiedByInitials: '',
    crossReference: '',
    donorSex: '',
    donorAge: '',
    recoveryDate: '',
    instructionVerificationInitials: '',
    processingDate: '',
    cleanRoomLogReviewInitials: '',
    cleanRoomLogReviewDate: '',
    tissueCheckedInInitials: '',
    tissueCheckedInDate: '',
  },
  labels: [
    { tglnNumber: '', regenmedId: '', side: '' },
    { tglnNumber: '', regenmedId: '', side: '' },
  ],
  specialInstructions: '',
  opsReview: { initials: '', date: '' },
  rows: MP_PRESET_ROWS.map(([description, frzFd, irradiated, comments]) => ({
    ...emptyMPRow(),
    description,
    frzFd,
    irradiated,
    comments,
  })),
});

// ------------------------------------------------------------ Lot Log (MP-F-021, 2 pages)

export interface LotRoomBlock {
  tpmInitials: string;
  date: string;
  roomNumber: string;
  techsInitials: string;
  /** Loosely written readings, e.g. "19.9°C", "33.3%", "008.1 pa" */
  roomTemp: string;
  roomRH: string;
  roomToAntechamber: string;
  antechamberToHallway: string;
}

export interface LotItemRow {
  item: string;
  lotNumber: string;
  expDate: string;
  manufacturer: string;
  voided?: boolean;
}
export interface LotQtyRow {
  item: string;
  lot: string;
  qtyUsed: string;
  voided?: boolean;
}
export interface LotSterileRow {
  item: string;
  loadNumber: string;
  sterilizationDate: string;
  voided?: boolean;
}

export interface LotLogData {
  header: { donorNumber: string };
  /** Page 1 · PROCESSING block */
  processing: LotRoomBlock & { bandsawInitials: string; bandsawDate: string };
  /** Page 1 · PACKAGING block */
  packaging: LotRoomBlock;
  /** Page 1 · Item table */
  p1Items: LotItemRow[];
  /** Page 1 · RegenMed Item table */
  p1RegenMed: LotQtyRow[];
  /** Page 2 · Item tables (left and right halves of the page) */
  p2ItemsLeft: LotSterileRow[];
  p2ItemsRight: LotSterileRow[];
  /** Page 2 · Packaging table */
  p2Packaging: LotQtyRow[];
}

export const LOT_P1_ITEMS = [
  'Process Pack',
  'Gown (L)',
  'Gloves (7)',
  'Gloves (7.5)',
  'Gloves',
  'H2O 1000 mL',
  'IPA 70% 500mL',
  'H2O2 4L',
  'Saline 0.9%',
  'Detergent (Brij-35)',
  'Pipettes',
  'Pulse Lavage',
  'Blades',
  'Bowl',
  'Table Cover',
  'Sutures',
  'Gauze',
  'Fascia Gauze',
  'Absorbent Towel',
  'IPA 70% 4L',
  'H2O 1000 mL',
  'H2O2 500 mL',
  'H2O 1000 mL',
];
export const LOT_REGENMED_ITEMS = ['Labels', 'Poly Bags (15)', 'Poly Bags (11)', 'Kapton Cover'];
/** Page 2 lists vary between forms, so these are editable starting rows, not a fixed list. */
export const LOT_P2_LEFT_START = ['BS Small Tray', 'Sieve', ''];
export const LOT_P2_RIGHT_START = ['BS Large Tray', 'Rongeur', ''];
export const LOT_PACKAGING_START = ['8x18 (10)', '10x15 (10)', ''];

const emptyRoom = (): LotRoomBlock => ({
  tpmInitials: '',
  date: '',
  roomNumber: '',
  techsInitials: '',
  roomTemp: '',
  roomRH: '',
  roomToAntechamber: '',
  antechamberToHallway: '',
});
export const emptyLotItem = (item = ''): LotItemRow => ({ item, lotNumber: '', expDate: '', manufacturer: '' });
export const emptyLotQty = (item = ''): LotQtyRow => ({ item, lot: '', qtyUsed: '' });
export const emptyLotSterile = (item = ''): LotSterileRow => ({ item, loadNumber: '', sterilizationDate: '' });

export const emptyLotLog = (): LotLogData => ({
  header: { donorNumber: '' },
  processing: { ...emptyRoom(), bandsawInitials: '', bandsawDate: '' },
  packaging: emptyRoom(),
  p1Items: LOT_P1_ITEMS.map((i) => emptyLotItem(i)),
  p1RegenMed: LOT_REGENMED_ITEMS.map((i) => emptyLotQty(i)),
  p2ItemsLeft: LOT_P2_LEFT_START.map((i) => emptyLotSterile(i)),
  p2ItemsRight: LOT_P2_RIGHT_START.map((i) => emptyLotSterile(i)),
  p2Packaging: LOT_PACKAGING_START.map((i) => emptyLotQty(i)),
});

export interface FormDataMap {
  'MP-F-023': MPF023Data;
  'QS-F-049': QSF049Data;
  LOT_LOG: LotLogData;
  DISCARD: DiscardData;
}
