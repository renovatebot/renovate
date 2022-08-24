import { logger } from '../../../../logger';
import { EQUAL, GT, GTE, LT, LTE, NOT_EQUAL, PGTE } from '../operator';
import { Range, parseRanges, satisfiesRange, stringifyRanges } from '../range';
import { adapt, decrement, floor, increment } from '../version';

// Common logic for replace, widen, and bump strategies
// It basically makes the range stick to the new version.
export function replacePart(part: Range, to: string): Range {
  const { operator, version: ver, companion } = part;
  switch (operator) {
    case LT:
      return { ...part, version: increment(ver, to) };
    case LTE:
      return { ...part, version: to };
    case PGTE:
      if (companion) {
        return {
          ...part,
          version: floor(adapt(to, ver)),
          companion: { ...companion, version: to },
        };
      } else {
        return { ...part, version: floor(adapt(to, ver)) };
      }
    case GT:
      return { ...part, version: decrement(to) };
    case GTE:
    case EQUAL:
      return { ...part, version: to };
    case NOT_EQUAL:
      return part;
    // istanbul ignore next
    default:
      logger.warn(`Unsupported operator '${operator}'`);
      return { operator: '', delimiter: ' ', version: '' };
  }
}

export default ({ range, to }: { range: string; to: string }): string => {
  const parts = parseRanges(range).map((part): Range => {
    if (satisfiesRange(to, part)) {
      // The new version satisfies the range. Keep it as-is.
      // Note that consecutive `~>` and `>=` parts are combined into one Range object,
      // therefore both parts are updated if the new version violates one of them.
      return part;
    }

    return replacePart(part, to);
  });

  return stringifyRanges(parts);
};
