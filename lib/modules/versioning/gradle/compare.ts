import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';

export const TokenType = {
  Number: 1,
  String: 2,
};

type Token = {
  type: number;
  val: string | number;
};

function iterateChars(
  str: string,
  cb: (p: string | null, n: string | null) => void,
): void {
  let prev = null;
  let next = null;
  for (let i = 0; i < str.length; i += 1) {
    next = str.charAt(i);
    cb(prev, next);
    prev = next;
  }
  cb(prev, null);
}

function isSeparator(char: string): boolean {
  return regEx(/^[-._+]$/i).test(char);
}

function isDigit(char: string): boolean {
  return regEx(/^\d$/).test(char);
}

function isLetter(char: string): boolean {
  return !isSeparator(char) && !isDigit(char);
}

function isTransition(prevChar: string, nextChar: string): boolean {
  return (
    (isDigit(prevChar) && isLetter(nextChar)) ||
    (isLetter(prevChar) && isDigit(nextChar))
  );
}

export function tokenize(versionStr: string): Token[] | null {
  let result: Token[] | null = [];
  let currentVal = '';

  function yieldToken(): void {
    if (currentVal === '') {
      // We tried to yield an empty token, which means we're in a bad state.
      result = null;
    }
    if (result) {
      const val = currentVal;
      if (regEx(/^\d+$/).test(val)) {
        result.push({
          type: TokenType.Number,
          val: parseInt(val, 10),
        });
      } else {
        result.push({
          type: TokenType.String,
          val,
        });
      }
    }
  }

  iterateChars(versionStr, (prevChar, nextChar) => {
    if (nextChar === null) {
      yieldToken();
    } else if (isSeparator(nextChar)) {
      yieldToken();
      currentVal = '';
    } else if (prevChar !== null && isTransition(prevChar, nextChar)) {
      yieldToken();
      currentVal = nextChar;
    } else {
      currentVal = currentVal.concat(nextChar);
    }
  });

  return result;
}

export const QualifierRank = {
  Dev: -1,
  Default: 0,
  RC: 1,
  Snapshot: 2,
  Final: 3,
  GA: 4,
  Release: 5,
  SP: 6,
} as const;

export function qualifierRank(input: string): number {
  const val = input.toLowerCase();
  if (val === 'dev') {
    return QualifierRank.Dev;
  }
  if (val === 'rc' || val === 'cr') {
    return QualifierRank.RC;
  }
  if (val === 'snapshot') {
    return QualifierRank.Snapshot;
  }
  if (val === 'ga') {
    return QualifierRank.GA;
  }
  if (val === 'final') {
    return QualifierRank.Final;
  }
  if (val === 'release' || val === 'latest' || val === 'sr') {
    return QualifierRank.Release;
  }
  if (val === 'sp') {
    return QualifierRank.SP;
  }
  return QualifierRank.Default;
}

function stringTokenCmp(left: string, right: string): number {
  const leftRank = qualifierRank(left);
  const rightRank = qualifierRank(right);
  if (leftRank === 0 && rightRank === 0) {
    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }
  } else {
    if (leftRank < rightRank) {
      return -1;
    }
    if (leftRank > rightRank) {
      return 1;
    }
  }
  return 0;
}

function tokenCmp(left: Token | null, right: Token | null): number {
  if (left === null) {
    if (right?.type === TokenType.String) {
      return 1;
    }
    return -1;
  }

  if (right === null) {
    if (left.type === TokenType.String) {
      return -1;
    }
    return 1;
  }

  if (left.type === TokenType.Number && right.type === TokenType.Number) {
    if (left.val < right.val) {
      return -1;
    }
    if (left.val > right.val) {
      return 1;
    }
  } else if (typeof left.val === 'string' && typeof right.val === 'string') {
    return stringTokenCmp(left.val, right.val);
  } else if (right.type === TokenType.Number) {
    return -1;
  } else if (left.type === TokenType.Number) {
    return 1;
  }

  return 0;
}

export function compare(left: string, right: string): number {
  const leftTokens = tokenize(left) ?? [];
  const rightTokens = tokenize(right) ?? [];
  const length = Math.max(leftTokens.length, rightTokens.length);
  for (let idx = 0; idx < length; idx += 1) {
    const leftToken = leftTokens[idx] || null;
    const rightToken = rightTokens[idx] || null;
    const cmpResult = tokenCmp(leftToken, rightToken);
    if (cmpResult !== 0) {
      return cmpResult;
    }
  }
  return 0;
}

export function parse(input: string): Token[] | null {
  if (!input) {
    return null;
  }

  if (!regEx(/^[-._+a-zA-Z0-9]+$/i).test(input)) {
    return null;
  }

  if (regEx(/^latest\.?/i).test(input)) {
    return null;
  }

  const tokens = tokenize(input);
  // istanbul ignore if: should not happen
  if (!tokens?.length) {
    return null;
  }
  return tokens;
}

export function isVersion(input: string): boolean {
  return !!parse(input);
}

interface PrefixRange {
  tokens: Token[];
}

export type RangeBound = 'inclusive' | 'exclusive';

interface MavenBasedRange {
  leftBound: RangeBound;
  leftBoundStr: string;
  leftVal: string | null;
  separator: string;
  rightBound: RangeBound;
  rightBoundStr: string;
  rightVal: string | null;
}

export function parsePrefixRange(input: string): PrefixRange | null {
  if (!input) {
    return null;
  }

  if (input.trim() === '+') {
    return { tokens: [] };
  }

  const postfixRegex = regEx(/[-._]\+$/);
  if (postfixRegex.test(input)) {
    const prefixValue = input.replace(regEx(/[-._]\+$/), '');
    const tokens = tokenize(prefixValue);
    return tokens ? { tokens } : null;
  }

  return null;
}

const mavenBasedRangeRegex = regEx(
  /^(?<leftBoundStr>[[\](]\s*)(?<leftVal>[-._+a-zA-Z0-9]*?)(?<separator>\s*,\s*)(?<rightVal>[-._+a-zA-Z0-9]*?)(?<rightBoundStr>\s*[[\])])$/,
);

export function parseMavenBasedRange(input: string): MavenBasedRange | null {
  if (!input) {
    return null;
  }

  const matchGroups = mavenBasedRangeRegex.exec(input)?.groups;
  if (matchGroups) {
    const { leftBoundStr, separator, rightBoundStr } = matchGroups;
    let leftVal: string | null = matchGroups.leftVal;
    let rightVal: string | null = matchGroups.rightVal;
    if (!leftVal) {
      leftVal = null;
    }
    if (!rightVal) {
      rightVal = null;
    }
    const isVersionLeft = is.string(leftVal) && isVersion(leftVal);
    const isVersionRight = is.string(rightVal) && isVersion(rightVal);
    if (
      (leftVal === null || isVersionLeft) &&
      (rightVal === null || isVersionRight)
    ) {
      if (
        isVersionLeft &&
        isVersionRight &&
        leftVal &&
        rightVal &&
        compare(leftVal, rightVal) === 1
      ) {
        return null;
      }
      const leftBound = leftBoundStr.trim() === '[' ? 'inclusive' : 'exclusive';
      const rightBound =
        rightBoundStr.trim() === ']' ? 'inclusive' : 'exclusive';
      return {
        leftBound,
        leftBoundStr,
        leftVal,
        separator,
        rightBound,
        rightBoundStr,
        rightVal,
      };
    }
  }

  return null;
}

export function isValid(str: string): boolean {
  if (!str) {
    return false;
  }

  return (
    isVersion(str) || !!parsePrefixRange(str) || !!parseMavenBasedRange(str)
  );
}
