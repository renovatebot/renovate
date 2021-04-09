import { isSingleVersion, parseRange, rangeToStr } from '../maven/compare';

const REV_TYPE_LATEST = 'REV_TYPE_LATEST';
const REV_TYPE_SUBREV = 'REV_TYPE_SUBREVISION';
const REV_TYPE_RANGE = 'REV_TYPE_RANGE';

export interface Revision {
  type: typeof REV_TYPE_LATEST | typeof REV_TYPE_RANGE | typeof REV_TYPE_SUBREV;

  value: string;
}

export const LATEST_REGEX = /^latest\.|^latest$/i;

function parseDynamicRevision(str: string): Revision | null {
  if (!str) {
    return null;
  }

  if (LATEST_REGEX.test(str)) {
    const value = str.replace(LATEST_REGEX, '').toLowerCase() || null;
    return {
      type: REV_TYPE_LATEST,
      value: value === 'integration' ? null : value,
    };
  }

  const SUBREV_REGEX = /\.\+$/;
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
    return {
      type: REV_TYPE_RANGE,
      value: rangeToStr(range),
    };
  }

  return null;
}

export {
  REV_TYPE_LATEST,
  REV_TYPE_SUBREV,
  REV_TYPE_RANGE,
  parseDynamicRevision,
};
