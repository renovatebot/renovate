import { TokenType } from './common';
import { extractRawTokens, tokenize } from './tokenizer';

function tokenTypes(input): string[] {
  return extractRawTokens(input).map((token) => token.type);
}

describe('manager/gradle-lite/tokenizer', () => {
  it('extractTokens', () => {
    const samples = {
      ' ': ['space'],
      '\t': ['space'],
      '\r': ['space'],
      '\t\r': ['space'],
      '\r\t': ['space'],
      '// foobar': ['lineComment'],
      '/* foobar */': ['multiComment'],
      '/* foo *//* bar */': ['multiComment', 'multiComment'],
      '/* foo\nbar\nbaz */': ['multiComment'],
      '/* foo\r\nbar\r\nbaz */': ['multiComment'],
      '\n\n': ['newline', 'newline'],
      ';': ['colon'],
      '.': ['dot'],
      '==': ['operator'],
      '=': ['assignment'],
      foo: ['word'],
      'foo.bar': ['word', 'dot', 'word'],
      'foo()': ['word', 'leftParen', 'rightParen'],
      'foo[]': ['word', 'leftBracket', 'rightBracket'],
      '{{}}': ['leftBrace', 'leftBrace', 'rightBrace', 'rightBrace'],
      '@': ['unknownChar'],
      "'\\''": ['singleQuotedStart', 'escapedChar', 'singleQuotedFinish'],
      "'\\\"'": ['singleQuotedStart', 'escapedChar', 'singleQuotedFinish'],
      "'\\'\\\"'": [
        'singleQuotedStart',
        'escapedChar',
        'escapedChar',
        'singleQuotedFinish',
      ],
      "'x'": ['singleQuotedStart', 'char', 'singleQuotedFinish'],
      "'\n'": ['singleQuotedStart', 'char', 'singleQuotedFinish'],
      "'$x'": ['singleQuotedStart', 'char', 'char', 'singleQuotedFinish'],
      "''''''": ['tripleQuotedStart', 'tripleQuotedFinish'],
      "'''x'''": ['tripleQuotedStart', 'char', 'tripleQuotedFinish'],
      "'''\n'''": ['tripleQuotedStart', 'char', 'tripleQuotedFinish'],
      "'''\\''''": ['tripleQuotedStart', 'escapedChar', 'tripleQuotedFinish'],
      "'''\\\"'''": ['tripleQuotedStart', 'escapedChar', 'tripleQuotedFinish'],
      "'''\\'\\\"'''": [
        'tripleQuotedStart',
        'escapedChar',
        'escapedChar',
        'tripleQuotedFinish',
      ],
      '""': ['doubleQuotedStart', 'doubleQuotedFinish'],
      '"\\""': ['doubleQuotedStart', 'escapedChar', 'doubleQuotedFinish'],
      '"\\\'"': ['doubleQuotedStart', 'escapedChar', 'doubleQuotedFinish'],
      '"\\"\\\'"': [
        'doubleQuotedStart',
        'escapedChar',
        'escapedChar',
        'doubleQuotedFinish',
      ],
      '"x"': ['doubleQuotedStart', 'char', 'doubleQuotedFinish'],
      '"\n"': ['doubleQuotedStart', 'char', 'doubleQuotedFinish'],
      // eslint-disable-next-line no-template-curly-in-string
      '"${x}"': ['doubleQuotedStart', 'variable', 'doubleQuotedFinish'],
      // eslint-disable-next-line no-template-curly-in-string
      '"${foo}"': ['doubleQuotedStart', 'variable', 'doubleQuotedFinish'],
      // eslint-disable-next-line no-template-curly-in-string
      '"${x()}"': [
        'doubleQuotedStart',
        'ignoredInterpolation',
        'unknownChar',
        'unknownChar',
        'unknownChar',
        'rightBrace',
        'doubleQuotedFinish',
      ],
      // eslint-disable-next-line no-template-curly-in-string
      '"${x{}}"': [
        'doubleQuotedStart',
        'ignoredInterpolation',
        'unknownChar',
        'leftBrace',
        'rightBrace',
        'rightBrace',
        'doubleQuotedFinish',
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
