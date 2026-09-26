import {
  emptyLotLog,
  emptyMPF023,
  emptyQSF049,
  type DiscardData,
  type LotLogData,
  type MPF023Data,
  type QSF049Data,
} from '../../lib/rules';

/**
 * "Load example with errors" data for the demo. Each example contains a few deliberate mistakes:
 * QS-F-049 — row 2 Technical date day-first, row 5 Quality missing initials,
 *            row 7 Quality date year-first (ISO), Item 10 INC # without a Status.
 *            (Row 3 uses dots and row 4 dashes: both valid.)
 * Discard  — Graft IDs listed but status Unprocessed, row 2 X box unmarked,
 *            Confirmed By blank, Authorized By date incomplete (warning).
 * MP-F-023 — Clean Room Log Review without a date, Ops Manager Review date day-first,
 *            Patellar Ligament # Packaged blank; Humeral Head voided; label 2 TGLN# typo (extra note).
 * Lot Log  — Pulse Lavage Exp. Date blank, Kapton Cover Qty Used blank, Sieve Load # blank;
 *            IPA 70% 4L voided; Processing Room Temp 26.1 °C (extra note).
 */

export function exampleQSF049(): QSF049Data {
  const d = emptyQSF049();
  d.header = { ddin: '24015', crossReference: 'TGLN-24-3381', graftIds: '24015-001 to 24015-012' };
  d.rows = d.rows.map((_, i) => ({
    technicalInitials: 'KS',
    technicalDate: i < 5 ? '09/25/24' : '09/26/24',
    qualityInitials: 'EW',
    qualityDate: '09/27/24',
  }));
  d.rows[1].technicalDate = '25/09/24';
  d.rows[2].technicalDate = '09.25.24';
  d.rows[3].technicalDate = '09-25-24';
  d.rows[4].qualityInitials = '';
  d.rows[5] = { ...d.rows[5], technicalInitials: 'N/A', technicalDate: 'N/A' };
  d.rows[6].qualityDate = '2024-09-27';
  d.rows[8] = { ...d.rows[8], qualityInitials: 'N/A', qualityDate: 'N/A' };
  d.item10 = { incNumber: 'INC-24-117', incStatus: '' };
  d.disposition = { decision: 'release', qaSignature: 'Emma Walsh', qaDate: '09/27/24' };
  return d;
}

export function exampleDiscard(): DiscardData {
  return {
    header: {
      donorNumber: '22043',
      authorizedByInitials: 'JM',
      authorizedByDate: '10/2',
      reason: 'Positive microbiology culture; tissue failed release criteria.',
    },
    tissueStatus: ['unprocessed'],
    tissues: [
      { graftId: '22043-004', description: 'R&L Patellar', storageLocation: 'Freezer 2 · Shelf B', xMarked: true },
      { graftId: '22043-005', description: 'Achilles Tendon', storageLocation: 'Freezer 2 · Shelf B', xMarked: false },
      { graftId: '22043-009', description: 'Semitendinosus', storageLocation: 'Freezer 3 · Shelf A', xMarked: true },
    ],
    bottom: {
      discardedBy: 'JM',
      confirmedBy: '',
      date: '10/02/24',
      freezerPro1Initials: 'KS',
      freezerPro1Date: '10/02/24',
      freezerPro2Initials: 'N/A',
      freezerPro2Date: 'N/A',
    },
  };
}

export function exampleMPF023(): MPF023Data {
  const d = emptyMPF023();
  d.header = {
    donorNumber: '25017',
    verifiedByInitials: 'KS',
    crossReference: 'RM-25-0431',
    donorSex: 'M',
    donorAge: '42',
    recoveryDate: '09/01/25',
    instructionVerificationInitials: 'EW',
    processingDate: '09/03/25',
    cleanRoomLogReviewInitials: 'JM',
    cleanRoomLogReviewDate: '',
    tissueCheckedInInitials: 'KS',
    tissueCheckedInDate: '09/03/25',
  };
  d.labels = [
    { tglnNumber: '25017', regenmedId: 'RM-25-0431', side: 'left' },
    { tglnNumber: '25071', regenmedId: 'RM-25-0431', side: 'right' },
  ];
  d.specialInstructions = 'Bilateral recovery. Prioritise tendons over cancellous.';
  d.opsReview = { initials: 'EW', date: '29/09/25' };
  const counts = ['2', '2', '2', '1', '2', '2', '1', '0', '1', '5', '1', '1', '2', '0'];
  d.rows = d.rows.map((r, i) => ({ ...r, produced: counts[i], packaged: counts[i] }));
  d.rows[5].packaged = '';
  d.rows[7].voided = true;
  return d;
}

const MANUFACTURERS = ['Medline', 'Baxter', 'Cardinal Health', 'Steris'];

export function exampleLotLog(): LotLogData {
  const d = emptyLotLog();
  d.header.donorNumber = '2142-635946';
  d.processing = {
    tpmInitials: 'KS',
    date: '09/03/25',
    roomNumber: 'CR-2',
    techsInitials: 'KS, EW',
    roomTemp: '26.1°C',
    roomRH: '33.3%',
    roomToAntechamber: '008.1 pa',
    antechamberToHallway: '012.4 pa',
    bandsawInitials: 'JM',
    bandsawDate: '09/03/25',
  };
  d.packaging = {
    tpmInitials: 'EW',
    date: '09/04/25',
    roomNumber: 'CR-3',
    techsInitials: 'EW',
    roomTemp: '21.4 °C',
    roomRH: '41%',
    roomToAntechamber: '9.6 Pa',
    antechamberToHallway: '6.2 Pa',
  };
  d.p1Items = d.p1Items.map((r, i) =>
    r.item === 'Gloves'
      ? { ...r, lotNumber: 'N/A', expDate: 'N/A', manufacturer: 'N/A' }
      : { ...r, lotNumber: `LT${4100 + i * 7}`, expDate: '12/31/26', manufacturer: MANUFACTURERS[i % MANUFACTURERS.length] },
  );
  const lavage = d.p1Items.findIndex((r) => r.item === 'Pulse Lavage');
  d.p1Items[lavage].expDate = '';
  d.p1Items[d.p1Items.findIndex((r) => r.item === 'IPA 70% 4L')].voided = true;
  d.p1RegenMed = d.p1RegenMed.map((r, i) => ({ ...r, lot: `IR-25-00${i + 1}`, qtyUsed: String(i + 2) }));
  d.p1RegenMed[3].qtyUsed = '';
  d.p2ItemsLeft = [
    { item: 'BS Small Tray', loadNumber: 'L-2231', sterilizationDate: '09/02/25' },
    { item: 'Sieve', loadNumber: '', sterilizationDate: '09/02/25' },
  ];
  d.p2ItemsRight = [
    { item: 'BS Large Tray', loadNumber: 'L-2231', sterilizationDate: '09/02/25' },
    { item: 'Rongeur', loadNumber: 'L-2229', sterilizationDate: '09/01/25' },
  ];
  d.p2Packaging = [
    { item: '8x18 (10)', lot: 'PK-7781', qtyUsed: '4' },
    { item: '10x15 (10)', lot: 'PK-7790', qtyUsed: '2' },
  ];
  return d;
}
