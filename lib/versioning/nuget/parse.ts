const versionPattern = /^(?<value>\d+(?:\.\d+)*)(?<preRelease>-[^+]+)?(\+.*)?$/;

interface SingleVersion {
  release: number[];
  suffix: string;
  isExact: boolean;
}

export function parseVersion(input: string): SingleVersion | null {
  let result = null;
  const isExact = input?.startsWith('[') && input?.endsWith(']');
  const matches = versionPattern.exec(
    input?.replace(/^\[/, '')?.replace(/]$/, '')
  );
  if (matches) {
    const { value, preRelease } = matches.groups;
    const release = value.split('.').map(Number);
    const suffix = preRelease || '';
    result = { release, suffix, isExact };
  }
  return result;
}

const intervalRangePattern = /^(?<leftBracket>[[(]?)\s*(?<leftValue>\d+(?:\.\d+)*(?:-[^+]+)?(?:\+.*)?)?\s*,\s*(?<rightValue>\d+(?:\.\d+)*(?:-[^+]+)?(?:\+.*)?)?\s*(?<rightBracket>[\])]?)$/;

interface IntervalRange {
  leftBracket?: '[' | '(';
  leftValue?: string | null;
  rightValue?: string | null;
  rightBracket?: ']' | ')';
}

export function parseIntervalRange(input: string): IntervalRange | null {
  let result = null;
  const match = intervalRangePattern.exec(input);
  if (match) {
    const { leftBracket, rightBracket, leftValue, rightValue } = match.groups;
    if (
      (leftBracket === '[' || leftBracket === '(') &&
      (rightBracket === ']' || rightBracket === ')')
    ) {
      result = {
        leftBracket,
        leftValue: parseVersion(leftValue) ? leftValue : null,
        rightValue: parseVersion(rightValue) ? rightValue : null,
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
    const release = prefix.split('.').map((x) => (x === '*' ? x : Number(x)));
    result = { release, suffix: prereleasesuffix || '' };
  }
  return result;
}
