import { GTE, LT, PGTE } from '../operator.ts';
import type { Range } from '../range.ts';
import { parseRanges, satisfiesRange, stringifyRanges } from '../range.ts';
import { increment, pgteUpperBound } from '../version.ts';
import { replacePart } from './replace.ts';

export default ({ range, to }: { range: string; to: string }): string => {
  const parts = parseRanges(range).flatMap((part): Range[] => {
    if (satisfiesRange(to, part)) {
      return [part];
    }

    const { operator, version: ver, companion } = part;
    switch (operator) {
      // `~>` works as both lower bound and upper bound.
      // We need to decompose it to get wider range.
      case PGTE: {
        // Prefer constraints from `>=`
        const baseVersion = companion ? companion.version : ver;
        const limit = increment(pgteUpperBound(ver), to);
        return [
          { operator: GTE, delimiter: ' ', version: baseVersion },
          { operator: LT, delimiter: ' ', version: limit },
        ];
      }
      default:
        return [replacePart(part, to)];
    }
  });

  return stringifyRanges(parts);
};
