import { regEx } from '../../../util/regex';
import { isSingleVersion, parseRange, rangeToStr } from '../maven/compare';

const REV_TYPE_LATEST = 'REV_TYPE_LATEST';
const REV_TYPE_SUBREV = 'REV_TYPE_SUBREVISION';
const REV_TYPE_RANGE = 'REV_TYPE_RANGE';

export interface Revision {
  type: typeof REV_TYPE_LATEST | typeof REV_TYPE_RANGE | typeof REV_TYPE_SUBREV;

  value: string;
}

export const LATEST_REGEX = regEx(/^latest\.|^latest$/i);

function parseDynamicRevision(str: string): Revision | null {
  if (!str) {
    return null;
  }

  if (LATEST_REGEX.test(str)) {
    const value = str.replace(LATEST_REGEX, '').toLowerCase() || '';
    return {
      type: REV_TYPE_LATEST,
      value: value === 'integration' ? '' : value,
    };
  }

  const SUBREV_REGEX = regEx(/\.\+$/);
  if (str.endsWith('.+')) {
    const value = str.replace(SUBREV_REGEX, '');
    if (isSingleVersion(value)) {
      return {
        type: REV_TYPE_SUBREV,
        value,
      };
    }
  }

  const range = parseRange(str);
  if (range && range.length === 1) {
    const rangeValue = rangeToStr(range);
    if (rangeValue) {
      return {
        type: REV_TYPE_RANGE,
        value: rangeValue,
      };
    }
  }

  return null;
}

export {
  REV_TYPE_LATEST,
  REV_TYPE_SUBREV,
  REV_TYPE_RANGE,
  parseDynamicRevision,
};
