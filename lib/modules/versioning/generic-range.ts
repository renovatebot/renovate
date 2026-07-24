import { isNonEmptyString } from '@sindresorhus/is';
import { regEx } from '../../util/regex.ts';

export interface RangeComparator {
  operator: string;
  version: string;
}

// Comparator operators, longest first so `<=` is matched ahead of `<`, `>=`
// ahead of `>`, and `==` ahead of `=`.
const operators = ['<=', '>=', '==', '<', '>', '='];
const separator = regEx(/[\s,]+/);

/**
 * Parse a comparator range (for example `<=1.2.3`, `>1.0 <2.0`, or `=1.2.3`)
 * into its `{ operator, version }` terms, which are ANDed together. Returns
 * `null` when the input is not a comparator range (such as a bare version), so
 * callers can fall back to treating it as a version.
 *
 * The `isVersion` predicate validates each operand against the caller's own
 * version format and the caller compares with its own ordering, so this parser
 * stays independent of any single versioning scheme (unlike npm `semver`,
 * whose parser also coerces and normalizes the operands).
 */
export function parseRange(
  range: string,
  isVersion: (version: string) => boolean,
): RangeComparator[] | null {
  if (!isNonEmptyString(range)) {
    return null;
  }
  const comparators: RangeComparator[] = [];
  for (const term of range.trim().split(separator)) {
    const operator = operators.find((op) => term.startsWith(op));
    if (!operator) {
      return null;
    }
    const version = term.slice(operator.length);
    if (!isVersion(version)) {
      return null;
    }
    comparators.push({ operator, version });
  }
  return comparators;
}

/**
 * Given the result of comparing a version against a comparator's version
 * (negative when lower, zero when equal, positive when higher), return whether
 * the comparator's operator is satisfied.
 */
export function satisfiesComparator(
  comparison: number,
  operator: string,
): boolean {
  switch (operator) {
    case '<':
      return comparison < 0;
    case '<=':
      return comparison <= 0;
    case '>':
      return comparison > 0;
    case '>=':
      return comparison >= 0;
    default:
      return comparison === 0;
  }
}
