import { extractRawTokens, tokenize } from './tokenizer';

function tokenTypes(input: string): string[] {
  return extractRawTokens(input).map((token) => token.type);
}

describe('modules/manager/gradle/tokenizer', () => {
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
      ':': ['colon'],
      ';': ['semicolon'],
      '.': ['dot'],
      '==': ['operator'],
      '=': ['assignment'],
      foo: ['word'],
      'foo.bar': ['word', 'dot', 'word'],
      'foo()': ['word', 'leftParen', 'rightParen'],
      'foo[]': ['word', 'leftBracket', 'rightBracket'],
      '{{}}': ['leftBrace', 'leftBrace', 'rightBrace', 'rightBrace'],
      '@': ['unknownFragment'],
      "'\\''": ['singleQuotedStart', 'escapedChar', 'singleQuotedFinish'],
      "'\\\"'": ['singleQuotedStart', 'escapedChar', 'singleQuotedFinish'],
      "'\\'\\\"'": [
        'singleQuotedStart',
        'escapedChar',
        'escapedChar',
        'singleQuotedFinish',
      ],
      "'x'": ['singleQuotedStart', 'chars', 'singleQuotedFinish'],
      "'\n'": ['singleQuotedStart', 'chars', 'singleQuotedFinish'],
      "'$x'": ['singleQuotedStart', 'chars', 'singleQuotedFinish'],
      "''''''": ['tripleQuotedStart', 'tripleQuotedFinish'],
      "'''x'''": ['tripleQuotedStart', 'chars', 'tripleQuotedFinish'],
      "'''\n'''": ['tripleQuotedStart', 'chars', 'tripleQuotedFinish'],
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
      '"x"': ['doubleQuotedStart', 'chars', 'doubleQuotedFinish'],
      '"\n"': ['doubleQuotedStart', 'chars', 'doubleQuotedFinish'],

      '"${x}"': ['doubleQuotedStart', 'variable', 'doubleQuotedFinish'],

      '"${foo}"': ['doubleQuotedStart', 'variable', 'doubleQuotedFinish'],

      '"${x()}"': [
        'doubleQuotedStart',
        'ignoredInterpolation',
        'unknownFragment',
        'rightBrace',
        'doubleQuotedFinish',
      ],

      '"${x{}}"': [
        'doubleQuotedStart',
        'ignoredInterpolation',
        'unknownFragment',
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
      '@': [{ type: 'unknownFragment' }],
      '@@@': [{ type: 'unknownFragment' }],
      "'foobar'": [{ type: 'string', value: 'foobar' }],
      "'\\b'": [{ type: 'string', value: '\b' }],
      "'''foobar'''": [{ type: 'string', value: 'foobar' }],
      '"foobar"': [{ type: 'string', value: 'foobar' }],
      '"$foo"': [
        {
          type: 'interpolation',
          children: [{ type: 'variable' }],
        },
      ],

      '" foo ${ bar } baz "': [
        {
          type: 'interpolation',
          children: [
            { type: 'string', value: ' foo ' },
            { type: 'variable', value: 'bar' },
            { type: 'string', value: ' baz ' },
          ],
        },
      ],

      '"${ x + y }"': [{ type: 'interpolation', isValid: false }],
    };
    for (const [str, result] of Object.entries(samples)) {
      expect(tokenize(str)).toMatchObject(result);
    }
  });
});
