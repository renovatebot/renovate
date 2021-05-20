import { DateTime } from 'luxon';
import { isStable, isValid, api as nodever } from '.';

describe('semver.getNewValue()', () => {
  let dtLocal: any;
  beforeEach(() => {
    dtLocal = DateTime.local;
  });
  afterEach(() => {
    DateTime.local = dtLocal;
  });
  it('returns normalized newVersion', () => {
    expect(
      nodever.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: 'v1.1.0',
      })
    ).toEqual('1.1.0');
  });
  it('returns range', () => {
    expect(
      nodever.getNewValue({
        currentValue: '~8.0.0',
        rangeStrategy: 'replace',
        currentVersion: '8.0.2',
        newVersion: 'v8.2.0',
      })
    ).toEqual('~8.2.0');
  });
  it('isStable', () => {
    const t1 = DateTime.fromISO('2020-09-01');
    const t2 = DateTime.fromISO('2021-06-01');
    [
      ['16.0.0', t1, false],
      ['15.0.0', t1, false],
      ['14.9.0', t1, false],
      ['14.0.0', t2, true],
      ['12.0.3', t1, true],
      ['v12.0.3', t1, true],
      ['12.0.3a', t1, false],
      ['11.0.0', t1, false],

      ['10.0.0', t1, true],
      ['10.0.999', t1, true],
      ['10.1.0', t1, true],

      ['10.0.0a', t1, false],
      ['9.0.0', t1, false],
    ].forEach(([version, time, result]) => {
      DateTime.local = (...args) =>
        args.length ? dtLocal.apply(DateTime, args) : time;
      expect(isStable(version as string)).toBe(result);
    });
  });

  it('isValid', () => {
    expect(isValid === nodever.isValid).toBe(true);
  });
});
