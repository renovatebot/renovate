import { satisfies } from '@renovatebot/ruby-semver';
import { parse as _parse } from '@renovatebot/ruby-semver/dist/ruby/requirement.js';
import { Version, create } from '@renovatebot/ruby-semver/dist/ruby/version.js';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { EQUAL, GT, GTE, LT, LTE, NOT_EQUAL, PGTE } from './operator';

export interface Range {
  version: string;
  operator: string;
  delimiter: string;
  /**
   * If the range is `~>` and immediately followed by `>=`,
   * the latter range is considered the former's companion
   * and assigned here instead of being an independent range.
   *
   * Example: `'~> 6.2', '>= 6.2.1'`
   */
  companion?: Range;
}

const parse = (range: string): Range => {
  const regExp = regEx(
    /^(?<operator>[^\d\s]+)?(?<delimiter>\s*)(?<version>[0-9a-zA-Z-.]+)$/,
  );

  const value = (range || '').trim();

  const match = regExp.exec(value);
  if (match?.groups) {
    const { version, operator = '', delimiter } = match.groups;
    return { version, operator, delimiter };
  }

  return {
    version: '',
    operator: '',
    delimiter: ' ',
  };
};

/** Wrapper for {@link satisfies} for {@link Range} record. */
export function satisfiesRange(ver: string, range: Range): boolean {
  if (range.companion) {
    return (
      satisfies(ver, `${range.operator}${range.version}`) &&
      satisfiesRange(ver, range.companion)
    );
  } else {
    return satisfies(ver, `${range.operator}${range.version}`);
  }
}

/**
 * Parses a comma-delimited list of range parts,
 * with special treatment for a pair of `~>` and `>=` parts.
 */
export function parseRanges(range: string): Range[] {
  const originalRanges = range.split(',').map(parse);
  const ranges: Range[] = [];
  for (let i = 0; i < originalRanges.length; ) {
    if (
      i + 1 < originalRanges.length &&
      originalRanges[i].operator === PGTE &&
      originalRanges[i + 1].operator === GTE
    ) {
      ranges.push({
        ...originalRanges[i],
        companion: originalRanges[i + 1],
      });
      i += 2;
    } else {
      ranges.push(originalRanges[i]);
      i++;
    }
  }
  return ranges;
}

/**
 * Stringifies a list of range parts into a comma-separated string,
 * with special treatment for a pair of `~>` and `>=` parts.
 */
export function stringifyRanges(ranges: Range[]): string {
  return ranges
    .map((r) => {
      if (r.companion) {
        return `${r.operator}${r.delimiter}${r.version}, ${r.companion.operator}${r.companion.delimiter}${r.companion.version}`;
      } else {
        return `${r.operator}${r.delimiter}${r.version}`;
      }
    })
    .join(', ');
}

type GemRequirement = [string, Version];

const ltr = (version: string, range: string): boolean => {
  const gemVersion = create(version);
  if (!gemVersion) {
    logger.warn({ version }, `Invalid ruby version`);
    return false;
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
        logger.warn({ operator }, `Unsupported operator`);
        return false;
    }
  });

  return results.reduce((accumulator, value) => accumulator && value, true);
};

export { parse, ltr };
