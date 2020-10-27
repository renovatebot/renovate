import moo from 'moo';
import { StringInterpolation, Token, TokenType } from './common';

const escapedCharRegex = /\\['"bfnrt\\]/;
const escapedChars = {
  [TokenType.EscapedChar]: {
    match: escapedCharRegex,
    value: (x: string): string =>
      ({
        "\\'": "'",
        '\\"': '"',
        '\\b': '\b',
        '\\f': '\f',
        '\\n': '\n',
        '\\r': '\r',
        '\\t': '\t',
        '\\\\': '\\',
      }[x]),
  },
};

export const rawLexer = {
  // Top-level Groovy lexemes
  main: {
    [TokenType.LineComment]: { match: /\/\/.*?$/ },
    [TokenType.MultiComment]: { match: /\/\*[^]*?\*\//, lineBreaks: true },
    [TokenType.Newline]: { match: /\r?\n/, lineBreaks: true },
    [TokenType.Space]: { match: /[ \t\r]+/ },
    [TokenType.Semicolon]: ';',
    [TokenType.Colon]: ':',
    [TokenType.Dot]: '.',
    [TokenType.Comma]: ',',
    [TokenType.Operator]: /(?:==|\+=?|-=?|\/=?|\*\*?|\.+|:)/,
    [TokenType.Assignment]: '=',
    [TokenType.Word]: { match: /[a-zA-Z$_][a-zA-Z0-9$_]+/ },
    [TokenType.LeftParen]: { match: '(' },
    [TokenType.RightParen]: { match: ')' },
    [TokenType.LeftBracket]: { match: '[' },
    [TokenType.RightBracket]: { match: ']' },
    [TokenType.LeftBrace]: { match: '{', push: 'main' },
    [TokenType.RightBrace]: { match: '}', pop: 1 },
    [TokenType.TripleSingleQuotedStart]: {
      match: "'''",
      push: TokenType.TripleSingleQuotedStart,
    },
    [TokenType.TripleDoubleQuotedStart]: {
      match: '"""',
      push: TokenType.TripleDoubleQuotedStart,
    },
    [TokenType.SingleQuotedStart]: {
      match: "'",
      push: TokenType.SingleQuotedStart,
    },
    [TokenType.DoubleQuotedStart]: {
      match: '"',
      push: TokenType.DoubleQuotedStart,
    },
    [TokenType.UnknownLexeme]: { match: /./ },
  },

  // Tokenize triple-quoted string literal characters
  [TokenType.TripleSingleQuotedStart]: {
    ...escapedChars,
    [TokenType.TripleQuotedFinish]: { match: "'''", pop: 1 },
    [TokenType.Char]: { match: /[^]/, lineBreaks: true },
  },
  [TokenType.TripleDoubleQuotedStart]: {
    ...escapedChars,
    [TokenType.TripleQuotedFinish]: { match: '"""', pop: 1 },
    [TokenType.Char]: { match: /[^]/, lineBreaks: true },
  },

  // Tokenize single-quoted string literal characters
  [TokenType.SingleQuotedStart]: {
    ...escapedChars,
    [TokenType.SingleQuotedFinish]: { match: "'", pop: 1 },
    [TokenType.Char]: { match: /[^]/, lineBreaks: true },
  },

  // Tokenize double-quoted string literal chars and interpolations
  [TokenType.DoubleQuotedStart]: {
    ...escapedChars,
    [TokenType.DoubleQuotedFinish]: { match: '"', pop: 1 },
    variable: {
      // Supported: ${foo}, $foo, ${ foo.bar.baz }, $foo.bar.baz
      match: /\${\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*)*\s*}|\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/,
      value: (x: string): string =>
        x.replace(/^\${?\s*/, '').replace(/\s*}$/, ''),
    },
    [TokenType.IgnoredInterpolationStart]: {
      match: /\${/,
      push: TokenType.IgnoredInterpolationStart,
    },
    [TokenType.Char]: { match: /[^]/, lineBreaks: true },
  },

  // Ignore interpolation of complex expressions˙,
  // but track the balance of braces to find the end of interpolation.
  [TokenType.IgnoredInterpolationStart]: {
    [TokenType.LeftBrace]: {
      match: '{',
      push: TokenType.IgnoredInterpolationStart,
    },
    [TokenType.RightBrace]: { match: '}', pop: 1 },
    [TokenType.UnknownLexeme]: { match: /[^]/, lineBreaks: true },
  },
};

/*
  Turn UnknownLexeme chars to UnknownFragment strings
 */
function processUnknownLexeme(acc: Token[], token: Token): Token[] {
  if (token.type === TokenType.UnknownLexeme) {
    const prevToken: Token = acc[acc.length - 1];
    if (prevToken?.type === TokenType.UnknownFragment) {
      prevToken.value += token.value;
    } else {
      acc.push({ ...token, type: TokenType.UnknownFragment });
    }
  } else {
    acc.push(token);
  }
  return acc;
}

//
// Turn separated chars of string literal to single String token
//
function processChar(acc: Token[], token: Token): Token[] {
  const tokenType = token.type;
  const prevToken: Token = acc[acc.length - 1];
  if ([TokenType.Char, TokenType.EscapedChar].includes(tokenType)) {
    if (prevToken?.type === TokenType.String) {
      prevToken.value += token.value;
    } else {
      acc.push({ ...token, type: TokenType.String });
    }
  } else {
    acc.push(token);
  }
  return acc;
}

export function isInterpolationToken(
  token: Token
): token is StringInterpolation {
  return token?.type === TokenType.StringInterpolation;
}

//
// Turn all tokens between double quote pairs into StringInterpolation token
//
function processInterpolation(acc: Token[], token: Token): Token[] {
  if (token.type === TokenType.DoubleQuotedStart) {
    // This token will accumulate further strings and variables
    const interpolationToken: StringInterpolation = {
      type: TokenType.StringInterpolation,
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
    if (type === TokenType.DoubleQuotedFinish) {
      if (
        prevToken.isValid &&
        prevToken.children.every(({ type: t }) => t === TokenType.String)
      ) {
        // Nothing to interpolate, replace to String
        acc[acc.length - 1] = {
          type: TokenType.String,
          value: prevToken.children.map(({ value }) => value).join(''),
          offset: prevToken.offset,
        };
        return acc;
      }
      prevToken.isComplete = true;
    } else if (type === TokenType.String || type === TokenType.Variable) {
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
  TokenType.Space,
  TokenType.LineComment,
  TokenType.MultiComment,
  TokenType.Newline,
  TokenType.Semicolon,
  TokenType.SingleQuotedStart,
  TokenType.SingleQuotedFinish,
  TokenType.DoubleQuotedFinish,
  TokenType.TripleSingleQuotedStart,
  TokenType.TripleDoubleQuotedStart,
  TokenType.TripleQuotedFinish,
];

function filterTokens({ type }: Token): boolean {
  return !filteredTokens.includes(type);
}

export function extractRawTokens(input: string): Token[] {
  const lexer = moo.states(rawLexer);
  lexer.reset(input);
  return Array.from(lexer).map(
    ({ type, offset, value }) => ({ type, offset, value } as Token)
  );
}

export function processTokens(tokens: Token[]): Token[] {
  return tokens
    .reduce(processUnknownLexeme, [])
    .reduce(processChar, [])
    .reduce(processInterpolation, [])
    .filter(filterTokens);
}

export function tokenize(input: string): Token[] {
  return processTokens(extractRawTokens(input));
}
