import { TokenType } from './common';
import { extractRawTokens, tokenize } from './tokenizer';

function tokenTypes(input): string[] {
  return extractRawTokens(input).map((token) => token.type);
}

describe('manager/gradle/shallow/tokenizer', () => {
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
      '@': [TokenType.UnknownFragment],
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
        TokenType.Chars,
        TokenType.SingleQuotedFinish,
      ],
      "'\n'": [
        TokenType.SingleQuotedStart,
        TokenType.Chars,
        TokenType.SingleQuotedFinish,
      ],
      "'$x'": [
        TokenType.SingleQuotedStart,
        TokenType.Chars,
        TokenType.SingleQuotedFinish,
      ],
      "''''''": ['tripleQuotedStart', 'tripleQuotedFinish'],
      "'''x'''": ['tripleQuotedStart', TokenType.Chars, 'tripleQuotedFinish'],
      "'''\n'''": ['tripleQuotedStart', TokenType.Chars, 'tripleQuotedFinish'],
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
        TokenType.Chars,
        TokenType.DoubleQuotedFinish,
      ],
      '"\n"': [
        TokenType.DoubleQuotedStart,
        TokenType.Chars,
        TokenType.DoubleQuotedFinish,
      ],

      '"${x}"': [
        TokenType.DoubleQuotedStart,
        TokenType.Variable,
        TokenType.DoubleQuotedFinish,
      ],

      '"${foo}"': [
        TokenType.DoubleQuotedStart,
        TokenType.Variable,
        TokenType.DoubleQuotedFinish,
      ],

      '"${x()}"': [
        TokenType.DoubleQuotedStart,
        TokenType.IgnoredInterpolationStart,
        TokenType.UnknownFragment,
        TokenType.RightBrace,
        TokenType.DoubleQuotedFinish,
      ],

      '"${x{}}"': [
        TokenType.DoubleQuotedStart,
        TokenType.IgnoredInterpolationStart,
        TokenType.UnknownFragment,
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

      '"${ x + y }"': [{ type: TokenType.StringInterpolation, isValid: false }],
    };
    for (const [str, result] of Object.entries(samples)) {
      expect(tokenize(str)).toMatchObject(result);
    }
  });
});
