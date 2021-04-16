import { getName } from '../../../test/util';
import { TokenType } from './common';
import { extractRawTokens, tokenize } from './tokenizer';

function tokenTypes(input): string[] {
  return extractRawTokens(input).map((token) => token.type);
}

describe(getName(__filename), () => {
  it('extractTokens', () => {
    const samples = {
      ' ': [TokenType.Space],
      '\t': [TokenType.Space],
      '\r': [TokenType.Space],
      '\t\r': [TokenType.Space],
      '\r\t': [TokenType.Space],
      '// foobar': [TokenType.LineComment],
      '/* foobar */': [TokenType.MultiComment],
      '/* foo *//* bar */': [TokenType.MultiComment, TokenType.MultiComment],
      '/* foo\nbar\nbaz */': [TokenType.MultiComment],
      '/* foo\r\nbar\r\nbaz */': [TokenType.MultiComment],
      '\n\n': [TokenType.Newline, TokenType.Newline],
      ':': [TokenType.Colon],
      ';': [TokenType.Semicolon],
      '.': [TokenType.Dot],
      '==': [TokenType.Operator],
      '=': [TokenType.Assignment],
      foo: [TokenType.Word],
      'foo.bar': [TokenType.Word, TokenType.Dot, TokenType.Word],
      'foo()': [TokenType.Word, TokenType.LeftParen, TokenType.RightParen],
      'foo[]': [TokenType.Word, TokenType.LeftBracket, TokenType.RightBracket],
      '{{}}': [
        TokenType.LeftBrace,
        TokenType.LeftBrace,
        TokenType.RightBrace,
        TokenType.RightBrace,
      ],
      '@': [TokenType.UnknownLexeme],
      "'\\''": [
        TokenType.SingleQuotedStart,
        TokenType.EscapedChar,
        TokenType.SingleQuotedFinish,
      ],
      "'\\\"'": [
        TokenType.SingleQuotedStart,
        TokenType.EscapedChar,
        TokenType.SingleQuotedFinish,
      ],
      "'\\'\\\"'": [
        TokenType.SingleQuotedStart,
        TokenType.EscapedChar,
        TokenType.EscapedChar,
        TokenType.SingleQuotedFinish,
      ],
      "'x'": [
        TokenType.SingleQuotedStart,
        TokenType.Char,
        TokenType.SingleQuotedFinish,
      ],
      "'\n'": [
        TokenType.SingleQuotedStart,
        TokenType.Char,
        TokenType.SingleQuotedFinish,
      ],
      "'$x'": [
        TokenType.SingleQuotedStart,
        TokenType.Char,
        TokenType.Char,
        TokenType.SingleQuotedFinish,
      ],
      "''''''": ['tripleQuotedStart', 'tripleQuotedFinish'],
      "'''x'''": ['tripleQuotedStart', TokenType.Char, 'tripleQuotedFinish'],
      "'''\n'''": ['tripleQuotedStart', TokenType.Char, 'tripleQuotedFinish'],
      "'''\\''''": [
        'tripleQuotedStart',
        TokenType.EscapedChar,
        'tripleQuotedFinish',
      ],
      "'''\\\"'''": [
        'tripleQuotedStart',
        TokenType.EscapedChar,
        'tripleQuotedFinish',
      ],
      "'''\\'\\\"'''": [
        'tripleQuotedStart',
        TokenType.EscapedChar,
        TokenType.EscapedChar,
        'tripleQuotedFinish',
      ],
      '""': [TokenType.DoubleQuotedStart, TokenType.DoubleQuotedFinish],
      '"\\""': [
        TokenType.DoubleQuotedStart,
        TokenType.EscapedChar,
        TokenType.DoubleQuotedFinish,
      ],
      '"\\\'"': [
        TokenType.DoubleQuotedStart,
        TokenType.EscapedChar,
        TokenType.DoubleQuotedFinish,
      ],
      '"\\"\\\'"': [
        TokenType.DoubleQuotedStart,
        TokenType.EscapedChar,
        TokenType.EscapedChar,
        TokenType.DoubleQuotedFinish,
      ],
      '"x"': [
        TokenType.DoubleQuotedStart,
        TokenType.Char,
        TokenType.DoubleQuotedFinish,
      ],
      '"\n"': [
        TokenType.DoubleQuotedStart,
        TokenType.Char,
        TokenType.DoubleQuotedFinish,
      ],
      // eslint-disable-next-line no-template-curly-in-string
      '"${x}"': [
        TokenType.DoubleQuotedStart,
        TokenType.Variable,
        TokenType.DoubleQuotedFinish,
      ],
      // eslint-disable-next-line no-template-curly-in-string
      '"${foo}"': [
        TokenType.DoubleQuotedStart,
        TokenType.Variable,
        TokenType.DoubleQuotedFinish,
      ],
      // eslint-disable-next-line no-template-curly-in-string
      '"${x()}"': [
        TokenType.DoubleQuotedStart,
        TokenType.IgnoredInterpolationStart,
        TokenType.UnknownLexeme,
        TokenType.UnknownLexeme,
        TokenType.UnknownLexeme,
        TokenType.RightBrace,
        TokenType.DoubleQuotedFinish,
      ],
      // eslint-disable-next-line no-template-curly-in-string
      '"${x{}}"': [
        TokenType.DoubleQuotedStart,
        TokenType.IgnoredInterpolationStart,
        TokenType.UnknownLexeme,
        TokenType.LeftBrace,
        TokenType.RightBrace,
        TokenType.RightBrace,
        TokenType.DoubleQuotedFinish,
      ],
    };
    for (const [str, result] of Object.entries(samples)) {
      expect(tokenTypes(str)).toStrictEqual(result);
    }
  });

  it('tokenize', () => {
    const samples = {
      '@': [{ type: TokenType.UnknownFragment }],
      '@@@': [{ type: TokenType.UnknownFragment }],
      "'foobar'": [{ type: TokenType.String, value: 'foobar' }],
      "'\\b'": [{ type: TokenType.String, value: '\b' }],
      "'''foobar'''": [{ type: TokenType.String, value: 'foobar' }],
      '"foobar"': [{ type: TokenType.String, value: 'foobar' }],
      '"$foo"': [
        {
          type: TokenType.StringInterpolation,
          children: [{ type: TokenType.Variable }],
        },
      ],
      // eslint-disable-next-line no-template-curly-in-string
      '" foo ${ bar } baz "': [
        {
          type: TokenType.StringInterpolation,
          children: [
            { type: TokenType.String, value: ' foo ' },
            { type: TokenType.Variable, value: 'bar' },
            { type: TokenType.String, value: ' baz ' },
          ],
        },
      ],
      // eslint-disable-next-line no-template-curly-in-string
      '"${ x + y }"': [{ type: TokenType.StringInterpolation, isValid: false }],
    };
    for (const [str, result] of Object.entries(samples)) {
      expect(tokenize(str)).toMatchObject(result);
    }
  });
});
