import { gte, lte } from '@renovatebot/ruby-semver';
import { logger } from '../../../logger';
import { EQUAL, GT, GTE, LT, LTE, NOT_EQUAL, PGTE } from '../operator';
import {
  combineRangePatterns,
  parse as parseRange,
  stringify as stringifyRange,
} from '../range';
import { decrement, increment } from '../version';

export default ({
  range,
  to,
  keepLowerBound,
}: {
  range: string;
  to: string;
  keepLowerBound?: boolean;
}): string => {
  const ranges = combineRangePatterns(range.split(',').map(parseRange));
  const results = ranges.map(
    ({ operator, version: ver, delimiter, truncateAt }) => {
      if (operator === GTE && keepLowerBound) {
        return `${operator}${delimiter}${ver}`;
      }
      switch (operator) {
        case GT:
          return lte(to, ver)
            ? `${GT}${delimiter}${ver}`
            : `${GT}${delimiter}${decrement(to)}`;
        case LT:
          return gte(to, ver)
            ? `${LT}${delimiter}${increment(ver, to)}`
            : `${LT}${delimiter}${ver}`;
        case PGTE:
          return stringifyRange({
            operator,
            delimiter,
            version: to,
            truncateAt,
          });
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
    }
  );

  return results.join(', ');
};
