import { hasKey } from './object';

describe('util/object', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('finds key in regular object', () => {
    expect(hasKey('foo', { foo: true })).toBeTrue();
  });

  it('detects missing key in regular object', () => {
    expect(hasKey('foo', { bar: true })).toBeFalse();
  });

  it('returns false for wrong instance type', () => {
    expect(hasKey('foo', 'i-am-not-an-object')).toBeFalse();
  });
});
