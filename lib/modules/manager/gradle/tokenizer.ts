import moo from 'moo';
import { regEx } from '../../../util/regex';
import type { StringInterpolation, Token } from './types';

const escapedCharRegex = /\\['"bfnrt\\]/; // TODO #12870
const escapedChars = {
  ['escapedChar']: {
    match: escapedCharRegex,
    value: (x: string): string =>
      /* istanbul ignore next */
      ({
        "\\'": "'",
        '\\"': '"',
        '\\b': '\b',
        '\\f': '\f',
        '\\n': '\n',
        '\\r': '\r',
        '\\t': '\t',
        '\\\\': '\\',
      }[x] ?? x),
  },
};

const lexer = moo.states({
  // Top-level Groovy lexemes
  main: {
    ['lineComment']: { match: /\/\/.*?$/ }, // TODO #12870
    ['multiComment']: { match: /\/\*[^]*?\*\//, lineBreaks: true }, // TODO #12870
    ['newline']: { match: /\r?\n/, lineBreaks: true }, // TODO #12870
    ['space']: { match: /[ \t\r]+/ }, // TODO #12870
    ['semicolon']: ';',
    ['colon']: ':',
    ['dot']: '.',
    ['comma']: ',',
    ['operator']: /(?:==|\+=?|-=?|\/=?|\*\*?|\.+|:)/, // TODO #12870
    ['assignment']: '=',
    ['word']: { match: /[a-zA-Z$_][a-zA-Z0-9$_]*/ }, // TODO #12870
    ['leftParen']: { match: '(' },
    ['rightParen']: { match: ')' },
    ['leftBracket']: { match: '[' },
    ['rightBracket']: { match: ']' },
    ['leftBrace']: { match: '{', push: 'main' },
    ['rightBrace']: { match: '}', pop: 1 },
    ['tripleQuotedStart']: {
      match: "'''",
      push: 'tripleQuotedStart',
    },
    ['tripleDoubleQuotedStart']: {
      match: '"""',
      push: 'tripleDoubleQuotedStart',
    },
    ['singleQuotedStart']: {
      match: "'",
      push: 'singleQuotedStart',
    },
    ['doubleQuotedStart']: {
      match: '"',
      push: 'doubleQuotedStart',
    },
    ['unknownFragment']: moo.fallback,
  },

  // Tokenize triple-quoted string literal characters
  ['tripleQuotedStart']: {
    ...escapedChars,
    ['tripleQuotedFinish']: { match: "'''", pop: 1 },
    ['chars']: moo.fallback,
  },
  ['tripleDoubleQuotedStart']: {
    ...escapedChars,
    ['tripleQuotedFinish']: { match: '"""', pop: 1 },
    ['chars']: moo.fallback,
  },

  // Tokenize single-quoted string literal characters
  ['singleQuotedStart']: {
    ...escapedChars,
    ['singleQuotedFinish']: { match: "'", pop: 1 },
    ['chars']: moo.fallback,
  },

  // Tokenize double-quoted string literal chars and interpolations
  ['doubleQuotedStart']: {
    ...escapedChars,
    ['doubleQuotedFinish']: { match: '"', pop: 1 },
    variable: {
      // Supported: ${foo}, $foo, ${ foo.bar.baz }, $foo.bar.baz
      match:
        /\${\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*)*\s*}|\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/, // TODO #12870
      value: (x: string): string =>
        x.replace(regEx(/^\${?\s*/), '').replace(regEx(/\s*}$/), ''),
    },
    ['ignoredInterpolation']: {
      match: /\${/, // TODO #12870
      push: 'ignoredInterpolation',
    },
    ['chars']: moo.fallback,
  },

  // Ignore interpolation of complex expressions˙,
  // but track the balance of braces to find the end of interpolation.
  ['ignoredInterpolation']: {
    ['leftBrace']: {
      match: '{',
      push: 'ignoredInterpolation',
    },
    ['rightBrace']: { match: '}', pop: 1 },
    ['unknownFragment']: moo.fallback,
  },
});

//
// Turn substrings of chars and escaped chars into single String token
//
function processChars(acc: Token[], token: Token): Token[] {
  const tokenType = token.type;
  const prevToken: Token = acc[acc.length - 1];
  if (['chars', 'escapedChar'].includes(tokenType)) {
    // istanbul ignore if
    if (prevToken?.type === 'string') {
      prevToken.value += token.value;
    } else {
      acc.push({ ...token, type: 'string' });
    }
  } else {
    acc.push(token);
  }
  return acc;
}

export function isInterpolationToken(
  token: Token
): token is StringInterpolation {
  return token?.type === 'interpolation';
}

//
// Turn all tokens between double quote pairs into StringInterpolation token
//
function processInterpolation(acc: Token[], token: Token): Token[] {
  if (token.type === 'doubleQuotedStart') {
    // This token will accumulate further strings and variables
    const interpolationToken: StringInterpolation = {
      type: 'interpolation',
      children: [],
      isValid: true,
      isComplete: false,
      offset: token.offset + 1,
      value: '',
    };
    acc.push(interpolationToken);
    return acc;
  }

  const prevToken: Token = acc[acc.length - 1];
  if (isInterpolationToken(prevToken) && !prevToken.isComplete) {
    const type = token.type;
    if (type === 'doubleQuotedFinish') {
      if (
        prevToken.isValid &&
        prevToken.children.every(({ type: t }) => t === 'string')
      ) {
        // Nothing to interpolate, replace to String
        acc[acc.length - 1] = {
          type: 'string',
          value: prevToken.children.map(({ value }) => value).join(''),
          offset: prevToken.offset,
        };
        return acc;
      }
      prevToken.isComplete = true;
    } else if (type === 'string' || type === 'variable') {
      prevToken.children.push(token);
    } else {
      prevToken.children.push(token);
      prevToken.isValid = false;
    }
  } else {
    acc.push(token);
  }
  return acc;
}

const filteredTokens = [
  'space',
  'lineComment',
  'multiComment',
  'newline',
  'semicolon',
  'singleQuotedStart',
  'singleQuotedFinish',
  'doubleQuotedFinish',
  'tripleQuotedStart',
  'tripleDoubleQuotedStart',
  'tripleQuotedFinish',
];

function filterTokens({ type }: Token): boolean {
  return !filteredTokens.includes(type);
}

export function extractRawTokens(input: string): Token[] {
  lexer.reset(input);
  return Array.from(lexer).map(
    ({ type, offset, value }) => ({ type, offset, value } as Token)
  );
}

export function processTokens(tokens: Token[]): Token[] {
  return tokens
    .reduce(processChars, [])
    .reduce(processInterpolation, [])
    .filter(filterTokens);
}

export function tokenize(input: string): Token[] {
  return processTokens(extractRawTokens(input));
}
