import {
  capitalize,
  coerceString,
  looseEquals,
  replaceAt,
  stripTemplates,
} from './string';

describe('util/string', () => {
  describe('replaceAt', () => {
    test('replaceAt inserts newString which is one char longer than oldString', () => {
      const content = 'I am a dog';
      const index = 2;
      const newString = 'are';
      const oldString = 'am';

      const newContent = replaceAt(content, index, oldString, newString);

      expect(newContent).toBe('I are a dog');
    });

    test('replaceAt inserts newString which is significantly longer than oldString', () => {
      const content = 'I am a dog';
      const index = 2;
      const newString = 'want to have a new pet maybe';
      const oldString = 'am';

      const newContent = replaceAt(content, index, oldString, newString);

      expect(newContent).toBe('I want to have a new pet maybe a dog');
    });
  });

  describe('looseEquals', () => {
    test('reverts to literal match if either is falsey', () => {
      expect(looseEquals(undefined, null)).toBeFalse();
      expect(looseEquals(null, null)).toBeTrue();
      expect(looseEquals(null, '')).toBeFalse();
    });
  });

  it('coerceString', () => {
    expect(coerceString('foo')).toBe('foo');
    expect(coerceString('')).toBe('');
    expect(coerceString(undefined)).toBe('');
    expect(coerceString(null)).toBe('');
    expect(coerceString(null, 'foo')).toBe('foo');
  });

  describe('stripTemplates', () => {
    test.each`
      input                                                        | expected
      ${'This is {% template %} text.'}                            | ${'This is  text.'}
      ${'This is {%` template `%} text.'}                          | ${'This is  text.'}
      ${'Calculate {{ sum }} of numbers.'}                         | ${'Calculate  of numbers.'}
      ${'Calculate {{` sum `}} of numbers.'}                       | ${'Calculate  of numbers.'}
      ${'Text with {# comment #} embedded comment.'}               | ${'Text with  embedded comment.'}
      ${'Start {{ value }} middle {% code %} end {# note #}.'}     | ${'Start  middle  end .'}
      ${'Nested {{ {% pattern %} }} test.'}                        | ${'Nested  test.'}
      ${'Line before {%\n  multi-line\n  pattern\n%} line after.'} | ${'Line before  line after.'}
      ${'Plain text with no patterns.'}                            | ${'Plain text with no patterns.'}
      ${'Overlap {# comment {% nested %} #} test.'}                | ${'Overlap  test.'}
      ${'Unmatched {% pattern missing end.'}                       | ${'Unmatched {% pattern missing end.'}
      ${'Unmatched pattern missing start %}.'}                     | ${'Unmatched pattern missing start %}.'}
      ${'{{ first }}{% second %}{# third #}Final text.'}           | ${'Final text.'}
      ${'Empty patterns {% %}{{ }}{# #}.'}                         | ${'Empty patterns .'}
      ${'{% start %} Middle text {# end #}'}                       | ${' Middle text '}
      ${'{% a %}{{ b }}{# c #}'}                                   | ${''}
      ${'{%` only `%}{{` patterns `}}{# here #}'}                  | ${''}
      ${'Escaped \\{% not a pattern %\\} text.'}                   | ${'Escaped \\{% not a pattern %\\} text.'}
      ${'Content with escaped \\{\\{ braces \\}\\}.'}              | ${'Content with escaped \\{\\{ braces \\}\\}.'}
      ${'Unicode {{ 🚀🌟 }} characters.'}                          | ${'Unicode  characters.'}
      ${'Special {{ $^.*+?()[]{}|\\ }} characters.'}               | ${'Special  characters.'}
      ${'{% entire text %}'}                                       | ${''}
    `('"$input" -> "$expected"', ({ input, expected }) => {
      expect(stripTemplates(input)).toBe(expected);
    });
  });

  describe('capitalize', () => {
    it('capitalizes', () => {
      expect(capitalize('content')).toBe('Content');
      expect(capitalize('Content')).toBe('Content');
    });
  });
});
