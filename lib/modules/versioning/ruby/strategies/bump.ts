import { gt, gte, lt } from '@renovatebot/ruby-semver';
import { GTE, LT, LTE, NOT_EQUAL, PGTE } from '../operator';
import { Range, parseRanges, stringifyRanges } from '../range';
import { adapt, trimZeroes } from '../version';
import { replacePart } from './replace';

export default ({ range, to }: { range: string; to: string }): string => {
  const parts = parseRanges(range).map((part): Range => {
    const { operator, version: ver } = part;
    switch (operator) {
      // Update upper bound (`<` and `<=`) ranges only if the new version violates them
      case LT:
        return gte(to, ver) ? replacePart(part, to) : part;
      case LTE:
        return gt(to, ver) ? replacePart(part, to) : part;
      // `~>` ranges.
      case PGTE: {
        // Try to add / remove extra `>=` constraint.
        const trimmed = adapt(to, ver);
        if (trimZeroes(trimmed) === trimZeroes(to)) {
          // E.g. `'~> 5.2', '>= 5.2.0'`. In this case the latter is redundant.
          return { ...part, version: trimmed, companion: undefined };
        } else {
          // E.g. `'~> 5.2', '>= 5.2.1'`.
          return {
            ...part,
            version: trimmed,
            companion: { operator: GTE, delimiter: ' ', version: to },
          };
        }
      }
      case NOT_EQUAL:
        if (lt(ver, to)) {
          // The version to exclude is now out of range.
          return { ...part, operator: GTE, version: to };
        }
        return part;
      default:
        // For `=` and lower bound ranges, always keep it stick to the new version.
        return replacePart(part, to);
    }
  });

  return stringifyRanges(parts);
};
