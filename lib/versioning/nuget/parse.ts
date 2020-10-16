const versionPattern = /^(?<value>\d+(?:\.\d+)*)(?<preRelease>-[^+*,]+)?(\+[^+*,]+)?$/;

interface SingleVersion {
  release: number[];
  suffix: string;
  isExact: boolean;
}

export function parse(input: string): SingleVersion | null {
  let result = null;
  const isExact = input?.startsWith('[') && input?.endsWith(']');
  const matches = versionPattern.exec(
    input?.replace(/^\[/, '')?.replace(/]$/, '')
  );
  if (matches) {
    const { value, preRelease } = matches.groups;
    const suffix = preRelease || '';
    const release = value.split('.').map(Number);
    result = { release, suffix, isExact };
  }
  return result;
}

export function compare(version1: string, vervion2: string): number {
  const parsed1 = parse(version1);
  const parsed2 = parse(vervion2);
  if (!(parsed1 && parsed2)) {
    return 1;
  }
  const length = Math.max(parsed1.release.length, parsed2.release.length);
  for (let i = 0; i < length; i += 1) {
    // 2.1 and 2.1.0 are equivalent
    const part1 = parsed1.release[i] || 0;
    const part2 = parsed2.release[i] || 0;
    if (part1 !== part2) {
      return part1 - part2;
    }
  }
  // numeric version equals
  const suffixComparison = parsed1.suffix.localeCompare(parsed2.suffix);
  if (suffixComparison !== 0) {
    // Empty suffix should compare greater than non-empty suffix
    if (parsed1.suffix === '') {
      return 1;
    }
    if (parsed2.suffix === '') {
      return -1;
    }
  }
  return suffixComparison;
}

const intervalRangePattern = /^(?<leftBracket>[[(])\s*(?<leftValue>\d+(?:\.\d+)*(?:-[^+*]+)?(?:\+.*)?)?\s*,\s*(?<rightValue>\d+(?:\.\d+)*(?:-[^+*]+)?(?:\+.*)?)?\s*(?<rightBracket>[\])])$/;

interface IntervalRange {
  leftBracket?: '[' | '(';
  leftValue?: string;
  rightValue?: string;
  rightBracket?: ']' | ')';
}

export function parseIntervalRange(input: string): IntervalRange | null {
  let result = null;
  const match = intervalRangePattern.exec(input);
  if (match) {
    const { leftBracket, rightBracket, leftValue, rightValue } = match.groups;
    if (
      (leftBracket === '[' || leftBracket === '(') &&
      (rightBracket === ']' || rightBracket === ')') &&
      (leftValue || rightValue) &&
      (!leftValue || parse(leftValue)) &&
      (!rightValue || parse(rightValue)) &&
      (!(leftValue && rightValue) || compare(leftValue, rightValue) < 0)
    ) {
      result = {
        leftBracket,
        leftValue: leftValue || '',
        rightValue: rightValue || '',
        rightBracket,
      };
    }
  }
  return result;
}

const floatingRangePattern = /^((?:\d+|\*)(?:\.(?:\d+|\*))*)(-[^+]+)?(\+.*)?$/;

interface FloatingRange {
  release: (number | '*')[];
  suffix: string | '*';
}

export function parseFloatingRange(version: string): FloatingRange | null {
  let result = null;
  const matches = floatingRangePattern.exec(version);
  if (matches) {
    const [, prefix, prereleasesuffix] = matches;
    let invalid = false;
    let wildcard = false;
    const release = prefix.split('.').map((x) => {
      if (x === '*') {
        wildcard = true;
        return x;
      }
      const y = Number(x);
      if (Number.isNaN(y) || wildcard) {
        invalid = true;
      }
      return y;
    });
    if (!invalid) {
      result = {
        release,
        suffix: prereleasesuffix === '-*' ? '*' : prereleasesuffix || '',
      };
    }
  }
  return result;
}
