import { parse as _parse } from '@renovatebot/ruby-semver/dist/ruby/requirement';
import { Version, create } from '@renovatebot/ruby-semver/dist/ruby/version';
import { logger } from '../../logger';
import { EQUAL, GT, GTE, LT, LTE, NOT_EQUAL, PGTE } from './operator';
import { releaseSegments } from './version';

export interface Range {
  version: string;
  operator: string;
  delimiter: string;
  // Set when operator is PGTE.
  // Default value is releaseSegments(version).
  // Otherwise it originates from a combined range pattern like `~> 5.2, >= 5.2.1`.
  truncateAt?: number | null;
}

const parse = (range: string): Range => {
  const regExp =
    /^(?<operator>[^\d\s]+)?(?<delimiter>\s*)(?<version>[0-9a-zA-Z-.]+)$/;

  const value = (range || '').trim();

  const match = regExp.exec(value);
  if (match) {
    const { version = null, operator = null, delimiter = ' ' } = match.groups;
    const truncateAt =
      operator === PGTE ? releaseSegments(version).length : null;
    return { version, operator, delimiter, truncateAt };
  }

  return {
    version: null,
    operator: null,
    delimiter: ' ',
    truncateAt: null,
  };
};

const stringify = (range: Range): string => {
  const { version, operator, delimiter, truncateAt } = range;
  if (operator === PGTE && truncateAt) {
    const segments = releaseSegments(version);
    if (segments.length <= truncateAt) {
      return `${operator}${delimiter}${version}`;
    }
    // Adjust zeros
    while (segments.length > 0 && segments[segments.length - 1] === 0) {
      segments.pop();
    }
    while (segments.length < truncateAt) {
      segments.push(0);
    }
    if (segments.length <= truncateAt) {
      return `${operator}${delimiter}${segments.join('.')}`;
    }
    // Represent as two separate ranges
    const range1 = `${operator}${delimiter}${segments
      .slice(0, truncateAt)
      .join('.')}`;
    const range2 = `${GTE}${delimiter}${version}`;
    return `${range1}, ${range2}`;
  }
  return `${operator}${delimiter}${version}`;
};

// Treats patterns like '~> 5.2, >= 5.2.1' as a single range.
const combineRangePattern = (range1: Range, range2: Range): Range | null => {
  if (range1.operator === PGTE && range2.operator === GTE) {
    const segments1 = releaseSegments(range1.version);
    if (segments1.length !== range1.truncateAt) {
      // Already combined
      return null;
    }
    const segments2 = releaseSegments(range2.version);
    const adjustedSegments =
      segments1.length > 1 ? segments1 : segments1.concat([0]);
    const matchesPrefix = adjustedSegments.every(
      (segment, i) =>
        (i === adjustedSegments.length - 1 &&
          i < segments2.length &&
          segment <= segments2[i]) ||
        segment === segments2[i]
    );
    if (matchesPrefix) {
      return {
        version: range2.version,
        operator: range1.operator,
        delimiter: range1.delimiter,
        truncateAt: segments1.length,
      };
    }
  }
  return null;
};

const combineRangePatterns = (origRanges: Range[]): Range[] => {
  const ranges = [...origRanges];
  for (let i = 0; i + 1 < ranges.length; i += 1) {
    const newRange = combineRangePattern(ranges[i], ranges[i + 1]);
    if (newRange) {
      ranges.splice(i, i + 2, newRange);
    }
  }
  return ranges;
};

type GemRequirement = [string, Version];

const ltr = (version: string, range: string): boolean | null => {
  const gemVersion = create(version);
  if (!gemVersion) {
    logger.warn(`Invalid ruby version '${version}'`);
    return null;
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
        logger.warn(`Unsupported operator '${operator}'`);
        return null;
    }
  });

  return results.reduce((accumulator, value) => accumulator && value, true);
};

export { combineRangePatterns, parse, stringify, ltr };
