// match.spec.ts

import { match } from './match';

describe('util/package-rules/match', () => {
  const data = {
    foo: 'bar',
    num: 42,
    isActive: true,
    zero: 0,
    emptyString: '',
    nested: { prop: 'value' },
  };

  test('should return true for matching string values', () => {
    expect(match('foo = "bar"', data)).toBe(true);
  });

  test('should return false for non-matching string values', () => {
    expect(match('foo = "baz"', data)).toBe(false);
  });

  test('should return false for non-compatible string values', () => {
    expect(match('num = "baz"', data)).toBe(false);
  });

  test('should return true for matching number values', () => {
    expect(match('num = 42', data)).toBe(true);
  });

  test('should return false for non-matching number values', () => {
    expect(match('num = 24', data)).toBe(false);
  });

  test('should return true for matching boolean values', () => {
    expect(match('isActive = true', data)).toBe(true);
  });

  test('should return false for matching boolean-string mismatch', () => {
    expect(match('isActive = "true"', data)).toBe(false);
  });

  test('should return false for non-matching boolean values', () => {
    expect(match('isActive = false', data)).toBe(false);
  });

  test('should return true for inequality operator with non-matching values', () => {
    expect(match('foo != "baz"', data)).toBe(true);
  });

  test('should return false for inequality operator with matching values', () => {
    expect(match('foo != "bar"', data)).toBe(false);
  });

  test('should handle zero values correctly', () => {
    expect(match('zero = 0', data)).toBe(true);
    expect(match('zero != 1', data)).toBe(true);
  });

  test('should handle empty strings correctly', () => {
    expect(match('emptyString = ""', data)).toBe(true);
    expect(match('emptyString != "non-empty"', data)).toBe(true);
  });

  test('should return false if key does not exist in data', () => {
    expect(match('nonExistentKey = "value"', data)).toBe(false);
  });

  test('should return false if data is not a valid object', () => {
    expect(match('foo = "bar"', null)).toBe(false);
    expect(match('foo = "bar"', undefined)).toBe(false);
    expect(match('foo = "bar"', 42)).toBe(false);
  });

  test('should return false for invalid input string', () => {
    expect(match('invalid input', data)).toBe(false);
  });

  test('should handle boolean false correctly', () => {
    const testData = { isFalse: false };
    expect(match('isFalse = false', testData)).toBe(true);
    expect(match('isFalse != true', testData)).toBe(true);
  });

  test('should handle string with escaped quotes', () => {
    const testData = { text: 'He said "Hello"' };
    expect(match('text = "He said \\"Hello\\""', testData)).toBe(true);
  });

  test('should handle single quoted strings', () => {
    expect(match("foo = 'bar'", data)).toBe(true);
  });

  test('should ignore whitespace', () => {
    expect(match('  foo    =    "bar"  ', data)).toBe(true);
  });

  test('should handle numeric strings correctly', () => {
    const testData = { numString: '42' };
    expect(match('numString = "42"', testData)).toBe(true);
    expect(match('numString = 42', testData)).toBe(false); // Different types
  });

  test('should return false when comparing different types', () => {
    expect(match('num = "42"', data)).toBe(false);
  });
});
