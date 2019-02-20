const PREFIX_DOT = 'PREFIX_DOT';
const PREFIX_HYPHEN = 'PREFIX_HYPHEN';

const TYPE_NUMBER = 'TYPE_NUMBER';
const TYPE_QUALIFIER = 'TYPE_QUALIFIER';

function iterateChars(str, cb) {
  let prev = null;
  let next = null;
  for (let i = 0; i < str.length; i += 1) {
    next = str.charAt(i);
    cb(prev, next);
    prev = next;
  }
  cb(prev, null);
}

function isDigit(char) {
  return /^\d$/.test(char);
}

function isLetter(char) {
  return /^[a-z]$/i.test(char);
}

function isTransition(prevChar, nextChar) {
  return (
    (isDigit(prevChar) && isLetter(nextChar)) ||
    (isLetter(prevChar) && isDigit(nextChar))
  );
}

function iterateTokens(versionStr, cb) {
  let currentPrefix = PREFIX_HYPHEN;
  let currentVal = '';

  function yieldToken(transition = false) {
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

function isNull(token) {
  const val = token.val;
  return val === 0 || val === '' || val === 'final' || val === 'ga';
}

const zeroToken = {
  prefix: PREFIX_HYPHEN,
  type: TYPE_NUMBER,
  val: 0,
  isTransition: false,
};

function tokenize(versionStr) {
  let buf = [];
  let result = [];
  iterateTokens(versionStr.toLowerCase().replace(/^v/i, ''), token => {
    if (token.prefix === PREFIX_HYPHEN) {
      buf = [];
    }
    buf.push(token);
    if (!isNull(token)) {
      result = result.concat(buf);
      buf = [];
    }
  });
  return result.length ? result : [zeroToken];
}

function nullFor(token) {
  return {
    prefix: token.prefix,
    type: token.prefix === PREFIX_DOT ? TYPE_NUMBER : TYPE_QUALIFIER,
    val: token.prefix === PREFIX_DOT ? 0 : '',
  };
}

function commonOrder(token) {
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

function qualifierOrder(token) {
  const val = token.val;
  if (val === 'alpha' || (token.isTransition && val === 'a')) {
    return 1;
  }
  if (val === 'beta' || (token.isTransition && val === 'b')) {
    return 2;
  }
  if (val === 'milestone' || (token.isTransition && val === 'm')) {
    return 3;
  }
  if (val === 'rc' || val === 'cr') {
    return 4;
  }
  if (val === 'snapshot') {
    return 5;
  }
  if (val === '' || val === 'final' || val === 'ga') {
    return 6;
  }
  if (val === 'sp') {
    return 7;
  }
  return null;
}

function qualifierCmp(left, right) {
  const leftOrder = qualifierOrder(left);
  const rightOrder = qualifierOrder(right);
  if (leftOrder && rightOrder) {
    if (leftOrder === rightOrder) {
      return 0;
    }
    if (leftOrder < rightOrder) {
      return -1;
    }
    return 1;
  }
  if (left.val === right.val) {
    return 0;
  }
  if (left.val < right.val) {
    return -1;
  }
  // istanbul ignore next
  return 1;
}

function tokenCmp(left, right) {
  if (left.prefix === right.prefix) {
    if (left.type === TYPE_NUMBER && right.type === TYPE_NUMBER) {
      if (left.val === right.val) {
        return 0;
      }
      if (left.val < right.val) {
        return -1;
      }
      return 1;
    }
    if (left.type === TYPE_NUMBER) {
      return 1;
    }
    if (right.type === TYPE_NUMBER) {
      return -1;
    }
    return qualifierCmp(left, right);
  }
  const leftOrder = commonOrder(left);
  const rightOrder = commonOrder(right);
  // istanbul ignore if
  if (leftOrder === rightOrder) {
    return 0;
  }
  if (leftOrder < rightOrder) {
    return -1;
  }
  return 1;
}

function compare(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const length = Math.max(leftTokens.length, rightTokens.length);
  for (let idx = 0; idx < length; idx += 1) {
    const leftToken = leftTokens[idx] || nullFor(rightTokens[idx]);
    const rightToken = rightTokens[idx] || nullFor(leftTokens[idx]);
    const cmpResult = tokenCmp(leftToken, rightToken);
    if (cmpResult !== 0) return cmpResult;
  }
  return 0;
}

module.exports = {
  PREFIX_DOT,
  PREFIX_HYPHEN,
  TYPE_NUMBER,
  TYPE_QUALIFIER,
  tokenize,
  compare,
};
