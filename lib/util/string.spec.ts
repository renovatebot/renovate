import { coerceString, isUUID, looseEquals, replaceAt } from './string';

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

  describe('isUUID', () => {
    it('proper checks valid and invalid UUID strings', () => {
      expect(isUUID('{90b6646d-1724-4a64-9fd9-539515fe94e9}')).toBe(true);
      expect(isUUID('{90B6646D-1724-4A64-9FD9-539515FE94E9}')).toBe(true);
      expect(isUUID('not-a-uuid')).toBe(false);
    });
  });
});
