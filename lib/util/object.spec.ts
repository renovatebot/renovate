import { coerceObject, hasKey } from './object';

describe('util/object', () => {
  it('finds key in regular object', () => {
    expect(hasKey('foo', { foo: true })).toBeTrue();
  });

  it('detects missing key in regular object', () => {
    expect(hasKey('foo', { bar: true })).toBeFalse();
  });

  it('returns false for wrong instance type', () => {
    expect(hasKey('foo', 'i-am-not-an-object')).toBeFalse();
  });

  describe('coerceObject', () => {
    it('should return empty object', () => {
      expect(coerceObject(undefined)).toEqual({});
      expect(coerceObject(null)).toEqual({});
    });

    it('should return input object', () => {
      expect(coerceObject({})).toEqual({});
      expect(coerceObject({ name: 'name' })).toEqual({ name: 'name' });
      expect(coerceObject(undefined, { name: 'name' })).toEqual({
        name: 'name',
      });
    });
  });
});
