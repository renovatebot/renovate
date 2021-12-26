import { parse as _parse } from '@renovatebot/ruby-semver/dist/ruby/requirement.js';
import { Version, create } from '@renovatebot/ruby-semver/dist/ruby/version.js';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import { EQUAL, GT, GTE, LT, LTE, NOT_EQUAL, PGTE } from './operator';

export interface Range {
  version: string;
  operator: string;
  delimiter: string;
}

const parse = (range: string): Range => {
  const regExp = regEx(
    /^(?<operator>[^\d\s]+)?(?<delimiter>\s*)(?<version>[0-9a-zA-Z-.]+)$/
  );

  const value = (range || '').trim();

  const match = regExp.exec(value);
  if (match) {
    const { version = null, operator = null, delimiter = ' ' } = match.groups;
    return { version, operator, delimiter };
  }

  return {
    version: null,
    operator: null,
    delimiter: ' ',
  };
};

type GemRequirement = [string, Version];

const ltr = (version: string, range: string): boolean | null => {
  const gemVersion = create(version);
  if (!gemVersion) {
    logger.warn(`Invalid ruby version '${version}'`);
    return null;
  }
  const requirements: GemRequirement[] = range.split(',').map(_parse);

  const results = requirements.map(([operator, ver]) => {
    switch (operator) {
      case GT:
      case LT:
        return gemVersion.compare(ver) <= 0;
      case GTE:
      case LTE:
      case EQUAL:
      case NOT_EQUAL:
        return gemVersion.compare(ver) < 0;
      case PGTE:
        return (
          gemVersion.compare(ver) < 0 &&
          gemVersion.release().compare(ver.bump()) <= 0
        );
      // istanbul ignore next
      default:
        logger.warn(`Unsupported operator '${operator}'`);
        return null;
    }
  });

  return results.reduce((accumulator, value) => accumulator && value, true);
};

export { parse, ltr };
