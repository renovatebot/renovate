import type { RangeStrategy } from '../../types';
import swift from '.';

const {
  getNewValue,
  isValid,
  isVersion,
  minSatisfyingVersion,
  getSatisfyingVersion,
  isLessThanRange,
  matches,
} = swift;

describe('isValid(input)', () => {
  it('supports isVersion', () => {
    expect(isVersion('from: "1.2.3"')).toBe(false);
    expect(isVersion('1.2.3')).toBe(true);
  });
  it('understands Swift version ranges', () => {
    expect(isValid('from: "1.2.3"')).toBe(true);
    expect(isValid('from : "1.2.3"')).toBe(true);
    expect(isValid('from:"1.2.3"')).toBe(true);
    expect(isValid(' from:"1.2.3" ')).toBe(true);
    expect(isValid(' from : "1.2.3" ')).toBe(true);

    expect(isValid('"1.2.3"..."1.2.4"')).toBe(true);
    expect(isValid(' "1.2.3" ... "1.2.4" ')).toBe(true);

    expect(isValid('"1.2.3"...')).toBe(true);
    expect(isValid(' "1.2.3" ... ')).toBe(true);

    expect(isValid('..."1.2.4"')).toBe(true);
    expect(isValid(' ... "1.2.4" ')).toBe(true);

    expect(isValid('"1.2.3"..<"1.2.4"')).toBe(true);
    expect(isValid(' "1.2.3" ..< "1.2.4" ')).toBe(true);

    expect(isValid('..<"1.2.4"')).toBe(true);
    expect(isValid(' ..< "1.2.4" ')).toBe(true);
  });
  it('should return null for irregular versions', () => {
    expect(isValid('17.04.0')).toBeFalsy();
  });
  it('should support simple semver', () => {
    expect(isValid('1.2.3')).toBe(true);
    expect(isValid('v1.2.3')).toBe(true);
  });
  it('should support semver with dash', () => {
    expect(isValid('1.2.3-foo')).toBe(true);
  });
  it('should reject semver without dash', () => {
    expect(isValid('1.2.3foo')).toBeFalsy();
  });
  it('should support ranges', () => {
    expect(isValid('~1.2.3')).toBeFalsy();
    expect(isValid('^1.2.3')).toBeFalsy();
    expect(isValid('from: "1.2.3"')).toBe(true);
    expect(isValid('"1.2.3"..."1.2.4"')).toBe(true);
    expect(isValid('"1.2.3"..."1.2.4"')).toBe(true);
    expect(isValid('"1.2.3"..<"1.2.4"')).toBe(true);
    expect(isValid('"1.2.3"..<"1.2.4"')).toBe(true);
    expect(isValid('..."1.2.3"')).toBe(true);
    expect(isValid('..<"1.2.4"')).toBe(true);
    expect(
      minSatisfyingVersion(['1.2.3', '1.2.4', '1.2.5'], '..<"1.2.4"')
    ).toBe('1.2.3');
    expect(
      minSatisfyingVersion(['v1.2.3', 'v1.2.4', 'v1.2.5'], '..<"1.2.4"')
    ).toBe('1.2.3');
    expect(
      getSatisfyingVersion(['1.2.3', '1.2.4', '1.2.5'], '..<"1.2.4"')
    ).toBe('1.2.3');
    expect(
      getSatisfyingVersion(['v1.2.3', 'v1.2.4', 'v1.2.5'], '..<"1.2.4"')
    ).toBe('1.2.3');
    expect(
      getSatisfyingVersion(['1.2.3', '1.2.4', '1.2.5'], '..."1.2.4"')
    ).toBe('1.2.4');
    expect(isLessThanRange('1.2.3', '..."1.2.4"')).toBe(false);
    expect(isLessThanRange('v1.2.3', '..."1.2.4"')).toBe(false);
    expect(isLessThanRange('1.2.3', '"1.2.4"...')).toBe(true);
    expect(isLessThanRange('v1.2.3', '"1.2.4"...')).toBe(true);

    expect(matches('1.2.4', '..."1.2.4"')).toBe(true);
    expect(matches('v1.2.4', '..."1.2.4"')).toBe(true);
    expect(matches('1.2.4', '..."1.2.3"')).toBe(false);
    expect(matches('v1.2.4', '..."1.2.3"')).toBe(false);
  });
});
describe('getNewValue()', () => {
  it('supports range update', () => {
    [
      ['1.2.3', 'auto', '1.2.3', '1.2.4', '1.2.3'],
      ['v1.2.3', 'auto', 'v1.2.3', 'v1.2.4', 'v1.2.3'],
      ['from: "1.2.3"', 'auto', '1.2.3', '1.2.4', 'from: "1.2.4"'],
      ['from: "1.2.2"', 'auto', '1.2.3', '1.2.4', 'from: "1.2.4"'],
      ['"1.2.3"...', 'auto', '1.2.3', '1.2.4', '"1.2.4"...'],
      ['"1.2.3"..."1.2.4"', 'auto', '1.2.3', '1.2.5', '"1.2.3"..."1.2.5"'],
      ['"1.2.3"..<"1.2.4"', 'auto', '1.2.3', '1.2.5', '"1.2.3"..<"1.2.5"'],
      ['..."1.2.4"', 'auto', '1.2.3', '1.2.5', '..."1.2.5"'],
      ['..<"1.2.4"', 'auto', '1.2.3', '1.2.5', '..<"1.2.5"'],
    ].forEach(([range, rangeStrategy, currentVersion, newVersion, result]) => {
      const newValue = getNewValue({
        currentValue: range,
        rangeStrategy: rangeStrategy as RangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(newValue).toEqual(result);
    });
  });
});
