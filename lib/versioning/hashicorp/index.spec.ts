import { api as semver } from '.';

describe('semver.matches()', () => {
  it('handles tilde greater than', () => {
    expect(semver.matches('4.2.0', '~> 4.0')).toBe(true);
    expect(semver.matches('4.2.0', '~> 4.0.0')).toBe(false);
  });
});
describe('semver.getSatisfyingVersion()', () => {
  it('handles tilde greater than', () => {
    expect(
      semver.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0.0'
      )
    ).toBe('4.0.0');
  });
});
describe('semver.isValid()', () => {
  it('handles comma', () => {
    expect(semver.isValid('>= 1.0.0, <= 2.0.0')).toBeTruthy();
  });
});
describe('semver.isLessThanRange()', () => {
  it('handles comma', () => {
    expect(semver.isLessThanRange('0.9.0', '>= 1.0.0, <= 2.0.0')).toBe(true);
    expect(semver.isLessThanRange('1.9.0', '>= 1.0.0, <= 2.0.0')).toBe(false);
  });
});
describe('semver.minSatisfyingVersion()', () => {
  it('handles tilde greater than', () => {
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '~> 4.0.0'
      )
    ).toBeNull();
  });
});
describe('semver.getNewValue()', () => {
  it('handles tilde greater than', () => {
    expect(
      semver.getNewValue({
        currentValue: '~> 1.2',
        rangeStrategy: 'replace',
        fromVersion: '1.2.3',
        toVersion: '2.0.7',
      })
    ).toEqual('~> 2.0');
    expect(
      semver.getNewValue({
        currentValue: '~> 1.2.0',
        rangeStrategy: 'replace',
        fromVersion: '1.2.3',
        toVersion: '2.0.7',
      })
    ).toEqual('~> 2.0.0');
  });
  it('handles comma dividers', () => {
    expect(
      semver.getNewValue({
        currentValue: '>= 1.0.0, <= 2.0.0',
        rangeStrategy: 'widen',
        fromVersion: '1.2.3',
        toVersion: '2.0.7',
      })
    ).toEqual('>= 1.0.0, <= 2.0.7');
  });
});
