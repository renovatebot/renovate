import { create } from '@snyk/ruby-semver/lib/ruby/gem-version';
import { parse as _parse } from '@snyk/ruby-semver/lib/ruby/gem-requirement';
import { logger } from '../../logger';
import { EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE } from './operator';

const parse = range => {
  const regExp = /^([^\d\s]+)?\s?([0-9a-zA-Z-.-]+)$/g;

  const value = (range || '').trim();
  const matches = regExp.exec(value) || {};

  return {
    version: matches[2] || null,
    operator: matches[1] || null,
  };
};

const ltr = (version, range) => {
  const gemVersion = create(version);
  const requirements = range.split(',').map(_parse);

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
