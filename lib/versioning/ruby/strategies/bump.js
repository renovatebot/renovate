import { gte, lte } from '@snyk/ruby-semver';
import { logger } from '../../../logger';
import { EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE } from '../operator';
import { floor, increment, decrement } from '../version';
import { parse as parseRange } from '../range';

export default ({ range, to }) => {
  const ranges = range.split(',').map(parseRange);
  const results = ranges.map(({ operator, version: ver }) => {
    switch (operator) {
      case null:
        return to;
      case GT:
        return lte(to, ver) ? `${GT} ${ver}` : `${GT} ${decrement(to)}`;
      case LT:
        return gte(to, ver) ? `${LT} ${increment(ver, to)}` : `${LT} ${ver}`;
      case PGTE:
        return `${operator} ${floor(to)}`;
      case GTE:
      case LTE:
      case EQUAL:
        return `${operator} ${to}`;
      case NOT_EQUAL:
        return `${NOT_EQUAL} ${ver}`;
      // istanbul ignore next
      default:
        logger.warn(`Unsupported operator '${operator}'`);
        return null;
    }
  });

  return results.join(', ');
};
