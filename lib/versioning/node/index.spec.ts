import { api as nodever } from '.';

describe('semver.getNewValue()', () => {
  it('returns normalized toVersion', () => {
    expect(
      nodever.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'replace',
        fromVersion: '1.0.0',
        toVersion: 'v1.1.0',
      })
    ).toEqual('1.1.0');
  });
  it('returns range', () => {
    expect(
      nodever.getNewValue({
        currentValue: '~8.0.0',
        rangeStrategy: 'replace',
        fromVersion: '8.0.2',
        toVersion: 'v8.2.0',
      })
    ).toEqual('~8.2.0');
  });
  it('isStable', () => {
    expect(nodever.isStable('16.0.0')).toBeFalse();
    expect(nodever.isStable('15.0.0')).toBeFalse();
    expect(nodever.isStable('14.9.0')).toBeFalse();

    expect(nodever.isStable('12.0.3')).toBeTrue();
    expect(nodever.isStable('v12.0.3')).toBeTrue();
    expect(nodever.isStable('12.0.3a')).toBeFalse();

    expect(nodever.isStable('11.0.0')).toBeFalse();
    expect(nodever.isStable('10.0.0')).toBeTrue();
    expect(nodever.isStable('9.0.0')).toBeFalse();
  });
});
