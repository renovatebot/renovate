import { regEx } from '../../../util/regex';

const PREFIX_DOT = 'PREFIX_DOT';
const PREFIX_HYPHEN = 'PREFIX_HYPHEN';

const TYPE_NUMBER = 'TYPE_NUMBER';
const TYPE_QUALIFIER = 'TYPE_QUALIFIER';

export interface BaseToken {
  prefix: string;
  type: typeof TYPE_NUMBER | typeof TYPE_QUALIFIER;
  val: number | string;
  isTransition?: boolean;
}

export interface NumberToken extends BaseToken {
  type: typeof TYPE_NUMBER;
  val: number;
}

export interface QualifierToken extends BaseToken {
  type: typeof TYPE_QUALIFIER;
  val: string;
}

export type Token = NumberToken | QualifierToken;

function iterateChars(
  str: string,
  cb: (p: string | null, n: string | null) => void
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

function isDigit(char: string): boolean {
  return regEx(/^\d$/).test(char);
}

function isLetter(char: string): boolean {
  return regEx(/^[a-z_]$/i).test(char);
}

function isTransition(prevChar: string, nextChar: string): boolean {
  return (
    (isDigit(prevChar) && isLetter(nextChar)) ||
    (isLetter(prevChar) && isDigit(nextChar))
  );
}

function iterateTokens(versionStr: string, cb: (token: Token) => void): void {
  let currentPrefix = PREFIX_HYPHEN;
  let currentVal = '';

  function yieldToken(transition = false): void {
    const val = currentVal || '0';
    if (regEx(/^\d+$/).test(val)) {
      cb({
        prefix: currentPrefix,
        type: TYPE_NUMBER,
        val: parseInt(val, 10),
        isTransition: transition,
      });
    } else {
      cb({
        prefix: currentPrefix,
        type: TYPE_QUALIFIER,
        val,
        isTransition: transition,
      });
    }
  }

  iterateChars(versionStr, (prevChar, nextChar) => {
    if (nextChar === null) {
      yieldToken();
    } else if (nextChar === '-') {
      yieldToken();
      currentPrefix = PREFIX_HYPHEN;
      currentVal = '';
    } else if (nextChar === '.') {
      yieldToken();
      currentPrefix = PREFIX_DOT;
      currentVal = '';
    } else if (prevChar !== null && isTransition(prevChar, nextChar)) {
      yieldToken(true);
      currentPrefix = PREFIX_HYPHEN;
      currentVal = nextChar;
    } else {
      currentVal = currentVal.concat(nextChar);
    }
  });
}

function isNull(token: Token): boolean {
  const val = token.val;
  return (
    val === 0 ||
    val === '' ||
    val === 'final' ||
    val === 'ga' ||
    val === 'release' ||
    val === 'latest' ||
    val === 'sr'
  );
}

const zeroToken: NumberToken = {
  prefix: PREFIX_HYPHEN,
  type: TYPE_NUMBER,
  val: 0,
  isTransition: false,
};

function tokenize(versionStr: string, preserveMinorZeroes = false): Token[] {
  let buf: Token[] = [];
  let result: Token[] = [];
  let leadingZero = true;
  iterateTokens(versionStr.toLowerCase().replace(regEx(/^v/i), ''), (token) => {
    if (token.prefix === PREFIX_HYPHEN) {
      buf = [];
    }
    buf.push(token);
    if (!isNull(token)) {
      leadingZero = false;
      result = result.concat(buf);
      buf = [];
    } else if (leadingZero || preserveMinorZeroes) {
      result = result.concat(buf);
      buf = [];
    }
  });
  return result.length ? result : [zeroToken];
}

function nullFor(token: Token): Token {
  return token.type === TYPE_NUMBER
    ? {
        prefix: token.prefix,
        type: TYPE_NUMBER,
        val: 0,
      }
    : {
        prefix: token.prefix,
        type: TYPE_QUALIFIER,
        val: '',
      };
}

function commonOrder(token: Token): number {
  if (token.prefix === PREFIX_DOT && token.type === TYPE_QUALIFIER) {
    return 0;
  }
  if (token.prefix === PREFIX_HYPHEN && token.type === TYPE_QUALIFIER) {
    return 1;
  }
  if (token.prefix === PREFIX_HYPHEN && token.type === TYPE_NUMBER) {
    return 2;
  }
  return 3;
}

// eslint-disable-next-line typescript-enum/no-enum
export enum QualifierTypes {
  Alpha = 1,
  Beta,
  Milestone,
  RC,
  Snapshot,
  Release,
  SP,
}

export function qualifierType(token: Token): number | null {
  const val = token.val;
  if (val === 'alpha' || (token.isTransition && val === 'a')) {
    return QualifierTypes.Alpha;
  }
  if (val === 'beta' || (token.isTransition && val === 'b')) {
    return QualifierTypes.Beta;
  }
  if (val === 'milestone' || (token.isTransition && val === 'm')) {
    return QualifierTypes.Milestone;
  }
  if (val === 'rc' || val === 'cr' || val === 'preview') {
    return QualifierTypes.RC;
  }
  if (val === 'snapshot' || val === 'snap') {
    return QualifierTypes.Snapshot;
  }
  if (
    val === '' ||
    val === 'final' ||
    val === 'ga' ||
    val === 'release' ||
    val === 'latest' ||
    val === 'sr'
  ) {
    return QualifierTypes.Release;
  }
  if (val === 'sp') {
    return QualifierTypes.SP;
  }
  return null;
}

function qualifierCmp(left: Token, right: Token): number {
  const leftOrder = qualifierType(left);
  const rightOrder = qualifierType(right);
  if (leftOrder && rightOrder) {
    if (leftOrder < rightOrder) {
      return -1;
    }
    if (leftOrder > rightOrder) {
      return 1;
    }
    return 0;
  }

  if (leftOrder && leftOrder < QualifierTypes.Release) {
    return -1;
  }
  if (rightOrder && rightOrder < QualifierTypes.Release) {
    return 1;
  }

  if (left.val < right.val) {
    return -1;
  }
  if (left.val > right.val) {
    return 1;
  }
  return 0;
}

function tokenCmp(left: Token, right: Token): number {
  const leftOrder = commonOrder(left);
  const rightOrder = commonOrder(right);

  if (leftOrder < rightOrder) {
    return -1;
  }
  if (leftOrder > rightOrder) {
    return 1;
  }

  if (left.type === TYPE_NUMBER && right.type === TYPE_NUMBER) {
    if (left.val < right.val) {
      return -1;
    }
    if (left.val > right.val) {
      return 1;
    }
    return 0;
  }

  return qualifierCmp(left, right);
}

function compare(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const length = Math.max(leftTokens.length, rightTokens.length);
  for (let idx = 0; idx < length; idx += 1) {
    const leftToken = leftTokens[idx] || nullFor(rightTokens[idx]);
    const rightToken = rightTokens[idx] || nullFor(leftTokens[idx]);
    const cmpResult = tokenCmp(leftToken, rightToken);
    if (cmpResult !== 0) {
      return cmpResult;
    }
  }
  return 0;
}

function isVersion(version: unknown): version is string {
  if (!version || typeof version !== 'string') {
    return false;
  }
  if (!regEx(/^[a-z_0-9.-]+$/i).test(version)) {
    return false;
  }
  if (regEx(/^[.-]/).test(version)) {
    return false;
  }
  if (regEx(/[.-]$/).test(version)) {
    return false;
  }
  if (['latest', 'release'].includes(version.toLowerCase())) {
    return false;
  }
  const tokens = tokenize(version);
  return !!tokens.length;
}

const INCLUDING_POINT = 'INCLUDING_POINT';
const EXCLUDING_POINT = 'EXCLUDING_POINT';

function parseRange(rangeStr: string): Range[] | null {
  function emptyInterval(): Range {
    return {
      leftType: null,
      leftValue: null,
      leftBracket: null,
      rightType: null,
      rightValue: null,
      rightBracket: null,
    };
  }

  const commaSplit = rangeStr.split(/\s*,\s*/);
  let ranges: Range[] | null = [];
  let interval = emptyInterval();

  commaSplit.forEach((subStr) => {
    if (!ranges) {
      return;
    }
    if (interval.leftType === null) {
      if (regEx(/^\[.*]$/).test(subStr)) {
        const ver = subStr.slice(1, -1);
        ranges.push({
          leftType: INCLUDING_POINT,
          leftValue: ver,
          leftBracket: '[',
          rightType: INCLUDING_POINT,
          rightValue: ver,
          rightBracket: ']',
        });
        interval = emptyInterval();
      } else if (subStr.startsWith('[')) {
        const ver = subStr.slice(1);
        interval.leftType = INCLUDING_POINT;
        interval.leftValue = ver;
        interval.leftBracket = '[';
      } else if (subStr.startsWith('(') || subStr.startsWith(']')) {
        const ver = subStr.slice(1);
        interval.leftType = EXCLUDING_POINT;
        interval.leftValue = ver;
        interval.leftBracket = subStr[0];
      } else {
        ranges = null;
      }
    } else if (subStr.endsWith(']')) {
      const ver = subStr.slice(0, -1);
      interval.rightType = INCLUDING_POINT;
      interval.rightValue = ver;
      interval.rightBracket = ']';
      ranges.push(interval);
      interval = emptyInterval();
    } else if (subStr.endsWith(')') || subStr.endsWith('[')) {
      const ver = subStr.slice(0, -1);
      interval.rightType = EXCLUDING_POINT;
      interval.rightValue = ver;
      interval.rightBracket = subStr.endsWith(')') ? ')' : '[';
      ranges.push(interval);
      interval = emptyInterval();
    } else {
      ranges = null;
    }
  });

  if (interval.leftType) {
    return null;
  } // something like '[1,2],[3'
  if (!ranges?.length) {
    return null;
  }

  const lastIdx = ranges.length - 1;
  let prevValue: string | null = null;
  const result: Range[] = [];
  for (let idx = 0; idx < ranges.length; idx += 1) {
    const range = ranges[idx];
    const { leftType, leftValue, rightType, rightValue } = range;

    if (idx === 0 && leftValue === '') {
      if (leftType === EXCLUDING_POINT && isVersion(rightValue)) {
        prevValue = rightValue;
        result.push({ ...range, leftValue: null });
        continue;
      }
      return null;
    }
    if (idx === lastIdx && rightValue === '') {
      if (rightType === EXCLUDING_POINT && isVersion(leftValue)) {
        if (prevValue && compare(prevValue, leftValue) === 1) {
          return null;
        }
        result.push({ ...range, rightValue: null });
        continue;
      }
      return null;
    }
    if (isVersion(leftValue) && isVersion(rightValue)) {
      if (compare(leftValue, rightValue) === 1) {
        return null;
      }
      if (prevValue && compare(prevValue, leftValue) === 1) {
        return null;
      }
      prevValue = rightValue;
      result.push(range);
      continue;
    }
    return null;
  }
  return result;
}

function isValid(str: string): boolean {
  if (!str) {
    return false;
  }
  return isVersion(str) || !!parseRange(str);
}

export interface Range {
  leftType: typeof INCLUDING_POINT | typeof EXCLUDING_POINT | null;
  leftValue: string | null;
  leftBracket: string | null;
  rightType: typeof INCLUDING_POINT | typeof EXCLUDING_POINT | null;
  rightValue: string | null;
  rightBracket: string | null;
}

function rangeToStr(fullRange: Range[] | null): string | null {
  if (fullRange === null) {
    return null;
  }

  const valToStr = (val: string | null): string => (val === null ? '' : val);

  if (fullRange.length === 1) {
    const { leftBracket, rightBracket, leftValue, rightValue } = fullRange[0];
    if (
      leftValue === rightValue &&
      leftBracket === '[' &&
      rightBracket === ']'
    ) {
      return `[${valToStr(leftValue)}]`;
    }
  }

  const intervals = fullRange.map((val) =>
    [
      val.leftBracket,
      valToStr(val.leftValue),
      ',',
      valToStr(val.rightValue),
      val.rightBracket,
    ].join('')
  );
  return intervals.join(',');
}

function tokensToStr(tokens: Token[]): string {
  return tokens.reduce((result: string, token: Token, idx) => {
    const prefix = token.prefix === PREFIX_DOT ? '.' : '-';
    return `${result}${idx !== 0 && token.val !== '' ? prefix : ''}${
      token.val
    }`;
  }, '');
}

function coerceRangeValue(prev: string, next: string): string {
  const prevTokens = tokenize(prev, true);
  const nextTokens = tokenize(next, true);
  const resultTokens = nextTokens.slice(0, prevTokens.length);
  const align = Math.max(0, prevTokens.length - nextTokens.length);
  if (align > 0) {
    resultTokens.push(...prevTokens.slice(prevTokens.length - align));
  }
  return tokensToStr(resultTokens);
}

function incrementRangeValue(value: string): string {
  const tokens = tokenize(value);
  const lastToken = tokens[tokens.length - 1];
  if (typeof lastToken.val === 'number') {
    lastToken.val += 1;
    return coerceRangeValue(value, tokensToStr(tokens));
  }
  return value;
}

function autoExtendMavenRange(
  currentRepresentation: string,
  newValue: string
): string | null {
  const range = parseRange(currentRepresentation);
  if (!range) {
    return currentRepresentation;
  }
  const isPoint = (vals: Range[]): boolean => {
    if (vals.length !== 1) {
      return false;
    }
    const { leftType, leftValue, rightType, rightValue } = vals[0];
    return (
      leftType === 'INCLUDING_POINT' &&
      leftType === rightType &&
      leftValue === rightValue
    );
  };
  if (isPoint(range)) {
    return `[${newValue}]`;
  }

  const interval = [...range].reverse().find((elem) => {
    const { rightType, rightValue } = elem;
    return (
      rightValue === null ||
      (rightType === INCLUDING_POINT && compare(rightValue, newValue) === -1) ||
      (rightType === EXCLUDING_POINT && compare(rightValue, newValue) !== 1)
    );
  });

  if (!interval) {
    return currentRepresentation;
  }

  const { leftValue, rightValue } = interval;
  if (
    leftValue !== null &&
    rightValue !== null &&
    incrementRangeValue(leftValue) === rightValue
  ) {
    if (compare(newValue, leftValue) !== -1) {
      interval.leftValue = coerceRangeValue(leftValue, newValue);
      interval.rightValue = incrementRangeValue(interval.leftValue);
    }
  } else if (rightValue !== null) {
    if (interval.rightType === INCLUDING_POINT) {
      const tokens = tokenize(rightValue);
      const lastToken = tokens[tokens.length - 1];
      if (typeof lastToken.val === 'number') {
        interval.rightValue = coerceRangeValue(rightValue, newValue);
      } else {
        interval.rightValue = newValue;
      }
    } else {
      interval.rightValue = incrementRangeValue(
        coerceRangeValue(rightValue, newValue)
      );
    }
  } else if (leftValue !== null) {
    interval.leftValue = coerceRangeValue(leftValue, newValue);
  }

  return rangeToStr(range);
}

function isSubversion(majorVersion: string, minorVersion: string): boolean {
  const majorTokens = tokenize(majorVersion);
  const minorTokens = tokenize(minorVersion);

  let result = true;
  const len = majorTokens.length;
  for (let idx = 0; idx < len; idx += 1) {
    const major = majorTokens[idx];
    const minor = minorTokens[idx] || nullFor(majorTokens[idx]);
    const cmpResult = tokenCmp(major, minor);
    if (cmpResult !== 0) {
      result = false;
      break;
    }
  }
  return result;
}

export {
  PREFIX_DOT,
  PREFIX_HYPHEN,
  TYPE_NUMBER,
  TYPE_QUALIFIER,
  tokenize,
  isSubversion,
  compare,
  isVersion,
  isVersion as isSingleVersion,
  isValid,
  parseRange,
  rangeToStr,
  INCLUDING_POINT,
  EXCLUDING_POINT,
  autoExtendMavenRange,
};
