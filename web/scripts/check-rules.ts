/**
 * Sanity checks for the shared validators. Run with `npm run test:rules`
 * (esbuild bundles this file, Node runs it; no test framework needed).
 */
import {
  BOTH_REQUIRED,
  emptyDiscard,
  emptyLotLog,
  emptyMPF023,
  emptyQSF049,
  getIn,
  isNA,
  isValidMMDDYY,
  parseLooseNumber,
  validate,
  type DiscardData,
  type LotLogData,
  type MPF023Data,
  type QSF049Data,
} from '../src/lib/rules';
import { exampleDiscard, exampleLotLog, exampleMPF023, exampleQSF049 } from '../src/components/online/examples';
import type { Issue } from '../src/lib/types';

declare const process: { exit(code: number): never };

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.error(`FAIL  ${name}`, detail ?? '');
  }
}
const has = (issues: Issue[], ruleId: string, fieldKey?: string) =>
  issues.some((i) => i.ruleId === ruleId && (!fieldKey || i.fieldKey === fieldKey));
const errorsOf = (issues: Issue[]) => issues.filter((i) => i.severity === 'error');

// ---------- fixtures
function validQS(): QSF049Data {
  const d = emptyQSF049();
  d.header = { ddin: '24015', crossReference: 'X-1', graftIds: '24015-001' };
  d.rows = d.rows.map(() => ({ technicalInitials: 'KS', technicalDate: '09/25/24', qualityInitials: 'EW', qualityDate: '09/26/24' }));
  return d;
}
function validDiscard(): DiscardData {
  const d = exampleDiscard();
  d.header.authorizedByDate = '10/02/24';
  d.tissueStatus = ['unreleasedPackaged'];
  d.tissues = d.tissues.map((t) => ({ ...t, xMarked: true }));
  d.bottom.confirmedBy = 'KS';
  return d;
}
function validMP(): MPF023Data {
  const d = exampleMPF023();
  d.header.cleanRoomLogReviewDate = '09/03/25';
  d.labels[1].tglnNumber = '25017';
  d.opsReview.date = '09/29/25';
  d.rows = d.rows.map((r) => ({ ...r, produced: r.produced || '1', packaged: r.packaged || '1', voided: false }));
  return d;
}
function validLot(): LotLogData {
  const d = exampleLotLog();
  d.processing.roomTemp = '19.9°C';
  d.p1Items = d.p1Items.map((r) => ({ ...r, expDate: r.expDate || '12/31/26', voided: false }));
  d.p1RegenMed[3].qtyUsed = '1';
  d.p2ItemsLeft[1].loadNumber = 'L-2231';
  return d;
}

// ---------- dates
for (const v of ['09/25/24', '09-25-24', '11.29.24', '02/29/24', '12/31/99']) check(`"${v}" is a valid date`, isValidMMDDYY(v));
for (const v of ['29/11/24', '2024-11-29', 'Nov 29', 'Nov 29, 2024', '02/30/24', '13/01/24', '9/5/24', '09/25-24', '09/25/2024', ''])
  check(`"${v}" is rejected`, !isValidMMDDYY(v));

// ---------- helpers
for (const v of ['N/A', 'NA', 'n/a', '-', '—', '--']) check(`isNA("${v}")`, isNA(v));
for (const v of ['', 'KS', 'NAB']) check(`!isNA("${v}")`, !isNA(v));
for (const [v, n] of [['19.9°C', 19.9], ['33.3%', 33.3], ['008.1 pa', 8.1], ['  26 C', 26], ['-2', -2]] as const)
  check(`parseLooseNumber("${v}") = ${n}`, parseLooseNumber(v) === n, parseLooseNumber(v));
check('parseLooseNumber("n/a") = null', parseLooseNumber('n/a') === null);
check('BOTH_REQUIRED is on', BOTH_REQUIRED === true);

// ---------- QS-F-049
check('valid QS-F-049 has no issues', validate('QS-F-049', validQS()).length === 0, validate('QS-F-049', validQS()));
check('blank QS-F-049 flags every row', validate('QS-F-049', emptyQSF049()).filter((i) => i.ruleId === 'QS-REVIEWED').length === 20);
{
  const d = validQS();
  d.rows[0].technicalInitials = '';
  d.rows[0].technicalDate = '';
  check('blank row → QS-REVIEWED', has(validate('QS-F-049', d), 'QS-REVIEWED', 'rows[0].technicalInitials'));
}
for (const ok of ['09/25/24', '09-25-24', '11.29.24']) {
  const d = validQS();
  d.rows[1].qualityDate = ok;
  check(`${ok} → no QS-DATE-FMT`, !has(validate('QS-F-049', d), 'QS-DATE-FMT'));
}
for (const bad of ['29/11/24', '2024-11-29', 'Nov 29']) {
  const d = validQS();
  d.rows[1].qualityDate = bad;
  check(`${bad} → QS-DATE-FMT`, has(validate('QS-F-049', d), 'QS-DATE-FMT', 'rows[1].qualityDate'));
}
{
  const d = validQS();
  d.rows[1].qualityDate = '29/11/24';
  const msg = validate('QS-F-049', d).find((i) => i.ruleId === 'QS-DATE-FMT')?.message ?? '';
  check('day-first date message suggests 11/29/24', msg.includes('day-first') && msg.includes('11/29/24'), msg);
}
for (const [i, na] of [['N/A', 'N/A'], ['NA', ''], ['—', ''], ['n/a', 'n/a']]) {
  const d = validQS();
  d.rows[3].qualityInitials = i;
  d.rows[3].qualityDate = na;
  check(`N/A accepted ("${i}" / "${na}")`, validate('QS-F-049', d).length === 0, validate('QS-F-049', d));
}
{
  const d = validQS();
  d.rows[2].technicalDate = '';
  check('initials without date → QS-REVIEWED on date', has(validate('QS-F-049', d), 'QS-REVIEWED', 'rows[2].technicalDate'));
}
{
  const d = validQS();
  d.item10 = { incNumber: 'INC-24-117', incStatus: '' };
  check('INC # without Status → QS-INC-STATUS', has(validate('QS-F-049', d), 'QS-INC-STATUS', 'item10.incStatus'));
  d.item10.incStatus = 'Closed';
  check('INC # with Status → ok', !has(validate('QS-F-049', d), 'QS-INC-STATUS'));
  d.item10 = { incNumber: 'N/A', incStatus: '' };
  check('INC # N/A without Status → ok', !has(validate('QS-F-049', d), 'QS-INC-STATUS'));
}
check('QS example has exactly 4 deliberate errors', errorsOf(validate('QS-F-049', exampleQSF049())).length === 4, validate('QS-F-049', exampleQSF049()));

// ---------- Discard
check('valid Discard has no issues', validate('DISCARD', validDiscard()).length === 0, validate('DISCARD', validDiscard()));
{
  const d = validDiscard();
  d.tissueStatus = ['unprocessed'];
  check('Graft ID listed + Unprocessed → DISC-STATUS-GRAFT', has(validate('DISCARD', d), 'DISC-STATUS-GRAFT', 'tissueStatus'));
}
{
  const d = validDiscard();
  d.tissues = d.tissues.map((t) => ({ ...t, graftId: 'N/A' }));
  d.tissueStatus = ['releasedPackaged'];
  check('Graft IDs N/A + Released Packaged → DISC-STATUS-NA', has(validate('DISCARD', d), 'DISC-STATUS-NA'));
  d.tissueStatus = ['inProcessing'];
  check('Graft IDs N/A + In Processing → ok', validate('DISCARD', d).length === 0, validate('DISCARD', d));
}
{
  const d = validDiscard();
  d.tissueStatus = [];
  check('no status → DISC-STATUS-CHECKED', has(validate('DISCARD', d), 'DISC-STATUS-CHECKED'));
  d.tissueStatus = ['unprocessed', 'releasedPackaged'];
  check('two statuses → DISC-STATUS-CHECKED', has(validate('DISCARD', d), 'DISC-STATUS-CHECKED'));
}
{
  const d = validDiscard();
  d.tissues[1].xMarked = false;
  check('tissue row missing X → DISC-X-BOX', has(validate('DISCARD', d), 'DISC-X-BOX', 'tissues[1].xMarked'));
  d.tissues[1].voided = true;
  const issues = validate('DISCARD', d);
  check('voided tissue row → warning only', errorsOf(issues).length === 0 && issues.some((i) => i.category === 'voided'), issues);
}
{
  const d = validDiscard();
  d.tissues.push({ graftId: '', description: '', storageLocation: 'Freezer 1', xMarked: false });
  check('tissue row without Graft ID or description is ignored', validate('DISCARD', d).length === 0, validate('DISCARD', d));
}
{
  const d = validDiscard();
  d.header.donorNumber = '';
  d.bottom.confirmedBy = '';
  const issues = validate('DISCARD', d);
  check('blank Donor # → DISC-TOP-BLANK', has(issues, 'DISC-TOP-BLANK', 'header.donorNumber'));
  check('blank Confirmed By → DISC-BOTTOM-BLANK', has(issues, 'DISC-BOTTOM-BLANK', 'bottom.confirmedBy'));
}
{
  const d = validDiscard();
  d.bottom = { ...d.bottom, discardedBy: 'N/A', confirmedBy: 'NA', freezerPro1Initials: 'N/A', freezerPro1Date: 'N/A' };
  check('N/A accepted in bottom section', validate('DISCARD', d).length === 0, validate('DISCARD', d));
}
{
  const d = validDiscard();
  d.header.authorizedByDate = '';
  check('Authorized By without date → DISC-AUTH-BYDATE', has(validate('DISCARD', d), 'DISC-AUTH-BYDATE', 'header.authorizedByDate'));
}
check('blank Discard form → DISC-TOP-BLANK', has(validate('DISCARD', emptyDiscard()), 'DISC-TOP-BLANK'));

// ---------- MP-F-023
check('valid MP-F-023 has no issues', validate('MP-F-023', validMP()).length === 0, validate('MP-F-023', validMP()));
{
  const issues = validate('MP-F-023', emptyMPF023());
  check('blank MP-F-023 → MP-TOP-BLANK on Donor #', has(issues, 'MP-TOP-BLANK', 'header.donorNumber'));
  check('blank MP-F-023 → MP-OPS-REVIEW', has(issues, 'MP-OPS-REVIEW'));
  check('blank MP-F-023 → MP-PRODUCED on all 14 rows × 2', issues.filter((i) => i.ruleId === 'MP-PRODUCED').length === 28);
}
{
  const d = validMP();
  d.header.cleanRoomLogReviewDate = '';
  check('Clean Room Log Review without date → MP-BYDATE', has(validate('MP-F-023', d), 'MP-BYDATE', 'header.cleanRoomLogReviewDate'));
  d.header.cleanRoomLogReviewDate = 'Nov 3';
  check('Clean Room Log Review with "Nov 3" → MP-BYDATE error', errorsOf(validate('MP-F-023', d)).some((i) => i.ruleId === 'MP-BYDATE'));
}
{
  const d = validMP();
  d.opsReview.date = '29/09/25';
  check('Ops Review date day-first → MP-OPS-REVIEW error', has(errorsOf(validate('MP-F-023', d)), 'MP-OPS-REVIEW', 'opsReview.date'));
}
{
  const d = validMP();
  d.rows[5].packaged = '';
  check('blank # Packaged → MP-PRODUCED', has(validate('MP-F-023', d), 'MP-PRODUCED', 'rows[5].packaged'));
  d.rows[5].packaged = '0';
  d.rows[5].produced = '0';
  check('"0" counts as filled', !has(validate('MP-F-023', d), 'MP-PRODUCED'));
}
{
  const d = validMP();
  d.rows[7] = { ...d.rows[7], produced: '', packaged: '', voided: true };
  const issues = validate('MP-F-023', d);
  check('voided MP row → warning, not error', errorsOf(issues).length === 0 && has(issues, 'MP-PRODUCED', 'rows[7].voided'), issues);
  check('voided MP row warning is tagged voided', issues.find((i) => i.fieldKey === 'rows[7].voided')?.category === 'voided');
}
{
  const d = validMP();
  d.rows.push({ description: '', frzFd: '', irradiated: '', comments: '', produced: '', packaged: '' });
  check('empty added MP row is ignored', validate('MP-F-023', d).length === 0);
  d.rows[d.rows.length - 1].description = 'Fascia Lata';
  check('named added MP row is checked', has(validate('MP-F-023', d), 'MP-PRODUCED', `rows[${d.rows.length - 1}].produced`));
}
{
  const d = validMP();
  d.rows[0].shaded = true;
  d.rows[0].produced = '';
  check('shaded MP row is exempt', !has(validate('MP-F-023', d), 'MP-PRODUCED'));
}
{
  const d = validMP();
  d.labels[1].tglnNumber = '25071';
  d.labels[0].regenmedId = 'RM-25-9999';
  const issues = validate('MP-F-023', d);
  check('TGLN# ≠ Donor # → extra note', issues.some((i) => i.fieldKey === 'labels[1].tglnNumber' && i.category === 'extra-note'));
  check('RegenMed ID ≠ Cross Reference # → extra note', issues.some((i) => i.fieldKey === 'labels[0].regenmedId' && i.category === 'extra-note'));
  check('label mismatches are warnings only', errorsOf(issues).length === 0);
  d.labels[1].tglnNumber = ' 25 017 ';
  check('ID compare ignores spaces', !validate('MP-F-023', d).some((i) => i.fieldKey === 'labels[1].tglnNumber'));
}
{
  const issues = validate('MP-F-023', exampleMPF023());
  check('MP example has 3 errors', errorsOf(issues).length === 3, issues);
  check('MP example has a voided row and an extra note', issues.some((i) => i.category === 'voided') && issues.some((i) => i.category === 'extra-note'));
}

// ---------- Lot Log
check('valid Lot Log has no issues', validate('LOT_LOG', validLot()).length === 0, validate('LOT_LOG', validLot()));
{
  const issues = validate('LOT_LOG', emptyLotLog());
  check('blank Lot Log → LOT-P1-ITEM for every pre-printed item', issues.filter((i) => i.ruleId === 'LOT-P1-ITEM').length === 23 * 3);
  check('blank Lot Log ignores the empty starter rows', !issues.some((i) => /\[2\]/.test(i.fieldKey ?? '') && i.fieldKey?.startsWith('p2')));
  check('blank Lot Log has no room notes', !has(issues, 'LOT-ROOM'));
}
{
  const d = validLot();
  d.p1Items[0] = { ...d.p1Items[0], lotNumber: 'N/A', expDate: 'N/A', manufacturer: 'N/A' };
  check('"Not used" (all N/A) accepted', validate('LOT_LOG', d).length === 0);
  d.p1Items[1].expDate = '';
  check('blank Exp. Date → LOT-P1-ITEM', has(validate('LOT_LOG', d), 'LOT-P1-ITEM', 'p1Items[1].expDate'));
}
{
  const d = validLot();
  d.p1RegenMed[0].qtyUsed = '';
  check('Lot without Qty Used → LOT-P1-REGENMED (both required)', has(validate('LOT_LOG', d), 'LOT-P1-REGENMED', 'p1RegenMed[0].qtyUsed'));
  d.p1RegenMed[0].qtyUsed = '0';
  check('Qty Used "0" counts', !has(validate('LOT_LOG', d), 'LOT-P1-REGENMED'));
}
{
  const d = validLot();
  d.p2ItemsRight[1].loadNumber = '';
  const issue = validate('LOT_LOG', d).find((i) => i.ruleId === 'LOT-P2-ITEM');
  check('blank Load # → LOT-P2-ITEM on page 2', issue?.page === 2 && issue.fieldKey === 'p2ItemsRight[1].loadNumber', issue);
  check('section says right table', issue?.section === 'Page 2 · Item table (right)', issue?.section);
  check('field label is "Item · Load #"', issue?.field === 'Rongeur · Load #', issue?.field);
}
{
  const d = validLot();
  d.p2ItemsLeft.push({ item: '', loadNumber: '', sterilizationDate: '' });
  d.p2Packaging.push({ item: '', lot: '', qtyUsed: '' });
  check('empty rows are ignored', validate('LOT_LOG', d).length === 0);
}
{
  const d = validLot();
  d.p2Packaging[0] = { ...d.p2Packaging[0], lot: '', qtyUsed: '', voided: true };
  const issues = validate('LOT_LOG', d);
  check('voided packaging row → warning only', errorsOf(issues).length === 0 && has(issues, 'LOT-P2-PACKAGING', 'p2Packaging[0].voided'), issues);
}
{
  const d = validLot();
  d.processing.roomTemp = '26 °C';
  check('26 °C → extra note', validate('LOT_LOG', d).some((i) => i.fieldKey === 'processing.roomTemp' && i.category === 'extra-note'));
  d.processing.roomTemp = '14.9°C';
  check('14.9 °C → extra note', has(validate('LOT_LOG', d), 'LOT-ROOM', 'processing.roomTemp'));
  d.processing.roomTemp = '25°C';
  check('25 °C is in range', !has(validate('LOT_LOG', d), 'LOT-ROOM'));
  d.packaging.roomRH = '60.5%';
  check('RH 60.5% → extra note', has(validate('LOT_LOG', d), 'LOT-ROOM', 'packaging.roomRH'));
  d.packaging.roomRH = '60%';
  d.packaging.antechamberToHallway = '004.9 pa';
  check('4.9 Pa → extra note', has(validate('LOT_LOG', d), 'LOT-ROOM', 'packaging.antechamberToHallway'));
  d.packaging.antechamberToHallway = '4.98 Pa';
  check('4.98 Pa is fine', !has(validate('LOT_LOG', d), 'LOT-ROOM'));
  check('room notes are warnings only', errorsOf(validate('LOT_LOG', d)).length === 0);
}
{
  const issues = validate('LOT_LOG', exampleLotLog());
  check('Lot example has 3 errors', errorsOf(issues).length === 3, issues);
  check('Lot example has a voided row and a room extra note', issues.some((i) => i.category === 'voided') && has(issues, 'LOT-ROOM'));
}

// ---------- every fieldKey must resolve to a real field in the model
const keyed: [string, unknown, Issue[]][] = [
  ['QS example', exampleQSF049(), validate('QS-F-049', exampleQSF049())],
  ['QS blank', emptyQSF049(), validate('QS-F-049', emptyQSF049())],
  ['Discard example', exampleDiscard(), validate('DISCARD', exampleDiscard())],
  ['Discard blank', emptyDiscard(), validate('DISCARD', emptyDiscard())],
  ['MP example', exampleMPF023(), validate('MP-F-023', exampleMPF023())],
  ['MP blank', emptyMPF023(), validate('MP-F-023', emptyMPF023())],
  ['Lot example', exampleLotLog(), validate('LOT_LOG', exampleLotLog())],
  ['Lot blank', emptyLotLog(), validate('LOT_LOG', emptyLotLog())],
];
for (const [name, data, issues] of keyed) {
  const bad = issues.filter((i) => !i.fieldKey || getIn(data, i.fieldKey) === undefined);
  check(`${name}: every fieldKey resolves`, bad.length === 0, bad.map((i) => i.fieldKey));
  const ids = issues.map((i) => i.id);
  check(`${name}: issue ids are unique`, new Set(ids).size === ids.length, ids.filter((id, k) => ids.indexOf(id) !== k));
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
