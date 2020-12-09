import { DateTime } from 'luxon';
import { isStable, api as nodever } from '.';

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
    const now = DateTime.fromISO('2020-09-01');
    const then = DateTime.fromISO('2021-06-01');
    expect(isStable('16.0.0', now)).toBeFalse();
    expect(isStable('15.0.0', now)).toBeFalse();
    expect(isStable('14.9.0', now)).toBeFalse();
    expect(isStable('14.0.0', then)).toBeTrue();
    expect(isStable('12.0.3', now)).toBeTrue();
    expect(isStable('v12.0.3', now)).toBeTrue();
    expect(isStable('12.0.3a', now)).toBeFalse();
    expect(isStable('11.0.0', now)).toBeFalse();

    expect(isStable('10.0.0', now)).toBeTrue();
    expect(isStable('10.0.999', now)).toBeTrue();
    expect(isStable('10.1.0', now)).toBeTrue();

    expect(isStable('10.0.0a', now)).toBeFalse();
    expect(isStable('9.0.0', now)).toBeFalse();
  });
});
