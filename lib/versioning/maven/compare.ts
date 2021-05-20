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

function iterateChars(str: string, cb: (p: string, n: string) => void): void {
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
  return /^\d$/.test(char);
}

function isLetter(char: string): boolean {
  return /^[a-z]$/i.test(char);
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
    if (/^\d+$/.test(val)) {
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
  iterateTokens(versionStr.toLowerCase().replace(/^v/i, ''), (token) => {
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
  return token.prefix === PREFIX_DOT
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

export enum QualifierTypes {
  Alpha = 1,
  Beta,
  Milestone,
  RC,
  Snapshot,
  Release,
  SP,
}

export function qualifierType(token: Token): number {
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
  if (val === 'rc' || val === 'cr') {
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

function isVersion(version: string): boolean {
  if (!version) {
    return false;
  }
  if (!/^[a-z0-9.-]+$/i.test(version)) {
    return false;
  }
  if (/^[.-]/.test(version)) {
    return false;
  }
  if (/[.-]$/.test(version)) {
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

function parseRange(rangeStr: string): any {
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

  const commaSplit = rangeStr.split(',');
  let result: Range[] = [];
  let interval = emptyInterval();

  commaSplit.forEach((subStr) => {
    if (!result) {
      return;
    }
    if (interval.leftType === null) {
      if (/^\[.*]$/.test(subStr)) {
        const ver = subStr.slice(1, -1);
        result.push({
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
        result = null;
      }
    } else if (subStr.endsWith(']')) {
      const ver = subStr.slice(0, -1);
      interval.rightType = INCLUDING_POINT;
      interval.rightValue = ver;
      interval.rightBracket = ']';
      result.push(interval);
      interval = emptyInterval();
    } else if (subStr.endsWith(')') || subStr.endsWith('[')) {
      const ver = subStr.slice(0, -1);
      interval.rightType = EXCLUDING_POINT;
      interval.rightValue = ver;
      interval.rightBracket = subStr.endsWith(')') ? ')' : '[';
      result.push(interval);
      interval = emptyInterval();
    } else {
      result = null;
    }
  });

  if (interval.leftType) {
    return null;
  } // something like '[1,2],[3'
  if (!result || !result.length) {
    return null;
  }

  const lastIdx = result.length - 1;
  let prevValue: string = null;
  return result.reduce((acc, range, idx) => {
    const { leftType, leftValue, rightType, rightValue } = range;

    if (idx === 0 && leftValue === '') {
      if (leftType === EXCLUDING_POINT && isVersion(rightValue)) {
        prevValue = rightValue;
        return [...acc, { ...range, leftValue: null }];
      }
      return null;
    }
    if (idx === lastIdx && rightValue === '') {
      if (rightType === EXCLUDING_POINT && isVersion(leftValue)) {
        if (prevValue && compare(prevValue, leftValue) === 1) {
          return null;
        }
        return [...acc, { ...range, rightValue: null }];
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
      return [...acc, range];
    }
    return null;
  }, [] as Range[]);
}

function isValid(str: string): boolean {
  if (!str) {
    return false;
  }
  return isVersion(str) || !!parseRange(str);
}

export interface Range {
  leftType: typeof INCLUDING_POINT | typeof EXCLUDING_POINT;
  leftValue: string;
  leftBracket: string;
  rightType: typeof INCLUDING_POINT | typeof EXCLUDING_POINT;
  rightValue: string;
  rightBracket: string;
}

function rangeToStr(fullRange: Range[]): string | null {
  if (fullRange === null) {
    return null;
  }

  const valToStr = (val: string): string => (val === null ? '' : val);

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
  return tokens.reduce((result, token, idx) => {
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
  let nearestIntervalIdx = 0;
  const len = range.length;
  for (let idx = len - 1; idx >= 0; idx = -1) {
    const { leftValue, rightValue } = range[idx];
    if (rightValue === null) {
      nearestIntervalIdx = idx;
      break;
    }
    if (compare(rightValue, newValue) === -1) {
      nearestIntervalIdx = idx;
      break;
    }
    if (leftValue && compare(leftValue, newValue) !== 1) {
      return currentRepresentation;
    }
  }

  const interval = range[nearestIntervalIdx];
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

  if (interval.leftValue && interval.rightValue) {
    const correctRepresentation =
      compare(interval.leftValue, interval.rightValue) === 1
        ? null
        : rangeToStr(range);
    return correctRepresentation || currentRepresentation;
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
