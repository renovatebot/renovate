import { gte, lte } from '@snyk/ruby-semver';
import { logger } from '../../../logger';
import { EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE } from '../operator';
import { floor, increment, decrement } from '../version';
import { parse as parseRange } from '../range';

export default ({ range, to }: { range: string; to: string }): string => {
  const ranges = range.split(',').map(parseRange);
  const results = ranges.map(({ operator, version: ver, delimiter }) => {
    switch (operator) {
      case null:
        return to;
      case GT:
        return lte(to, ver)
          ? `${GT}${delimiter}${ver}`
          : `${GT}${delimiter}${decrement(to)}`;
      case LT:
        return gte(to, ver)
          ? `${LT}${delimiter}${increment(ver, to)}`
          : `${LT}${delimiter}${ver}`;
      case PGTE:
        return `${operator}${delimiter}${floor(to)}`;
      case GTE:
      case LTE:
      case EQUAL:
        return `${operator}${delimiter}${to}`;
      case NOT_EQUAL:
        return `${NOT_EQUAL}${delimiter}${ver}`;
      // istanbul ignore next
      default:
        logger.warn(`Unsupported operator '${operator}'`);
        return null;
    }
  });

  return results.join(', ');
};
