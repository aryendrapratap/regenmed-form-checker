import type { Issue } from '../types';
import { validateDiscard } from './discard';
import { validateLotLog } from './lotlog';
import type { FormDataMap } from './models';
import { validateMPF023 } from './mpf023';
import { validateQSF049 } from './qsf049';

export * from './models';
export { BOTH_REQUIRED, isBlank, isNA, isValidMMDDYY, hasInitialsAndDate, parseLooseNumber } from './helpers';
export { ROOM_LIMITS } from './lotlog';
export { getIn, setIn } from './path';
export { validateDiscard, validateLotLog, validateMPF023, validateQSF049 };

export type ValidatedForm = keyof FormDataMap;

const VALIDATORS: { [K in ValidatedForm]: (d: FormDataMap[K]) => Issue[] } = {
  'MP-F-023': validateMPF023,
  'QS-F-049': validateQSF049,
  LOT_LOG: validateLotLog,
  DISCARD: (d) => validateDiscard(d),
};

/** The single rule engine: used by Fill Online and (once the backend extracts into these models) by PDF review. */
export function validate<K extends ValidatedForm>(formType: K, data: FormDataMap[K]): Issue[] {
  return (VALIDATORS[formType] as (d: FormDataMap[K]) => Issue[])(data);
}
