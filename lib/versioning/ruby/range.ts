import { create, Version } from '@renovatebot/ruby-semver/dist/ruby/version';
import {
  parse as _parse,
  ParsedRequirement,
} from '@renovatebot/ruby-semver/dist/ruby/requirement';
import { logger } from '../../logger';
import { EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE } from './operator';

export interface Range {
  version: string;
  operator: string;
  delimiter: string;
}

const parse = (range: string): Range => {
  const regExp = /^(?<operator>[^\d\s]+)?(?<delimiter>\s*)(?<version>[0-9a-zA-Z-.-]+)$/;

  const value = (range || '').trim();

  const match = value.match(regExp);
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

const ltr = (version: string, range: string): boolean | null => {
  const gemVersion: Version | null = create(version);
  if (!gemVersion || !version) {
    logger.warn(`Invalid ruby version '${version}'`);
    return null;
  }
  const requirements: ParsedRequirement[] = range.split(',').map(_parse);

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
