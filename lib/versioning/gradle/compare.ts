enum TokenType {
  Number = 1,
  String,
}

enum Separator {
  Hyphen = '-',
  Dot = '.',
  Underscore = '',
  Plus = '+',
}

type Token = {
  type: TokenType;
  val: string | number;
  separator: Separator | null;
};

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

function isSeparator(char: string): char is Separator {
  return /^[-._+]$/i.test(char);
}

function isDigit(char: string): boolean {
  return /^\d$/.test(char);
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

function tokenize(versionStr: string): Token[] {
  let result = [];
  let currentVal = '';

  function yieldToken(): void {
    // istanbul ignore if
    if (currentVal === '') {
      result = null;
    }
    if (result) {
      const val = currentVal;
      if (/^\d+$/.test(val)) {
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

function isSpecial(str: string, special: string): boolean {
  return str.toLowerCase() === special;
}

function checkSpecial(left: string, right: string, tag: string): number | null {
  if (isSpecial(left, tag) && isSpecial(right, tag)) {
    return 0;
  }
  if (isSpecial(left, tag)) {
    return 1;
  }
  if (isSpecial(right, tag)) {
    return -1;
  }
  return null;
}

function stringTokenCmp(left: string, right: string): number {
  const dev = checkSpecial(left, right, 'dev');
  if (dev !== null) {
    return dev ? -dev : 0;
  }

  const final = checkSpecial(left, right, 'final');
  if (final !== null) {
    return final;
  }

  const release = checkSpecial(left, right, 'release');
  if (release !== null) {
    return release;
  }

  const rc = checkSpecial(left, right, 'rc');
  if (rc !== null) {
    return rc;
  }

  if (left === 'SNAPSHOT' || right === 'SNAPSHOT') {
    if (left.toLowerCase() < right.toLowerCase()) {
      return -1;
    }

    if (left.toLowerCase() > right.toLowerCase()) {
      return 1;
    }
  } else {
    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }
  }

  return 0;
}

function tokenCmp(left: Token | null, right: Token | null): number {
  if (left === null) {
    if (right.type === TokenType.String) {
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
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
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

export {};
