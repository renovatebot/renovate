import swift from '../../lib/versioning/swift';

const {
  getNewValue,
  isValid,
  minSatisfyingVersion,
  maxSatisfyingVersion,
  isLessThanRange,
  matches,
} = swift;

describe('isValid(input)', () => {
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
      maxSatisfyingVersion(['1.2.3', '1.2.4', '1.2.5'], '..<"1.2.4"')
    ).toBe('1.2.3');
    expect(
      maxSatisfyingVersion(['1.2.3', '1.2.4', '1.2.5'], '..."1.2.4"')
    ).toBe('1.2.4');
    expect(isLessThanRange('1.2.3', '..."1.2.4"')).toBe(false);
    expect(isLessThanRange('1.2.3', '"1.2.4"...')).toBe(true);
    expect(matches('1.2.4', '..."1.2.4"')).toBe(true);
    expect(matches('1.2.4', '..."1.2.3"')).toBe(false);
  });
});
describe('getNewValue()', () => {
  it('supports range update', () => {
    [
      ['1.2.3', 'auto', '1.2.3', '1.2.4', '1.2.3'],
      ['from: "1.2.3"', 'auto', '1.2.3', '1.2.4', '1.2.4'],
      ['"1.2.3"...', 'auto', '1.2.3', '1.2.4', '"1.2.4"...'],
      ['"1.2.3"..."1.2.4"', 'auto', '1.2.3', '1.2.5', '"1.2.3"..."1.2.5"'],
      ['"1.2.3"..<"1.2.4"', 'auto', '1.2.3', '1.2.5', '"1.2.3"..<"1.2.5"'],
      ['..."1.2.4"', 'auto', '1.2.3', '1.2.5', '..."1.2.5"'],
      ['..<"1.2.4"', 'auto', '1.2.3', '1.2.5', '..<"1.2.5"'],
    ].forEach(([range, strategy, fromVersion, toVersion, result]) => {
      // @ts-ignore
      const newValue = getNewValue(range, strategy, fromVersion, toVersion);
      expect(newValue).toEqual(result);
    });
  });
});
