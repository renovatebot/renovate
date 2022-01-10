import { DateTime } from 'luxon';
import { isStable, isValid, api as nodever, valueToVersion } from '.';

describe('versioning/node/index', () => {
  let dtLocal: any;
  beforeEach(() => {
    dtLocal = DateTime.local;
  });
  afterEach(() => {
    DateTime.local = dtLocal;
  });

  describe('getNewValue', () => {
    test.each`
      currentValue | rangeStrategy | currentVersion | newVersion   | expected
      ${'1.0.0'}   | ${'replace'}  | ${'1.0.0'}     | ${'v1.1.0'}  | ${'1.1.0'}
      ${'~8.0.0'}  | ${'replace'}  | ${'8.0.2'}     | ${'v8.2.0'}  | ${'~8.2.0'}
      ${'erbium'}  | ${'replace'}  | ${'12.0.0'}    | ${'v14.1.4'} | ${'fermium'}
      ${'Fermium'} | ${'replace'}  | ${'14.0.0'}    | ${'v16.1.6'} | ${'gallium'}
    `(
      'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
      ({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
        expected,
      }) => {
        const res = nodever.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        });
        expect(res).toBe(expected);
      }
    );
  });

  describe('isStable', () => {
    const t1 = DateTime.fromISO('2020-09-01');
    const t2 = DateTime.fromISO('2021-06-01');

    test.each`
      version       | time  | expected
      ${'16.0.0'}   | ${t1} | ${false}
      ${'15.0.0'}   | ${t1} | ${false}
      ${'14.9.0'}   | ${t1} | ${false}
      ${'14.0.0'}   | ${t2} | ${true}
      ${'12.0.3'}   | ${t1} | ${true}
      ${'v12.0.3'}  | ${t1} | ${true}
      ${'12.0.3a'}  | ${t1} | ${false}
      ${'11.0.0'}   | ${t1} | ${false}
      ${'10.0.0'}   | ${t1} | ${true}
      ${'10.0.999'} | ${t1} | ${true}
      ${'10.1.0'}   | ${t1} | ${true}
      ${'10.0.0a'}  | ${t1} | ${false}
      ${'9.0.0'}    | ${t1} | ${false}
    `('isStable("$version") === $expected', ({ version, time, expected }) => {
      DateTime.local = (...args) =>
        args.length ? dtLocal.apply(DateTime, args) : time;
      expect(isStable(version as string)).toBe(expected);
    });
  });

  it('isValid', () => {
    expect(isValid === nodever.isValid).toBeTrue();
  });

  describe('valueToVersion', () => {
    test.each`
      value        | expected
      ${'Erbium'}  | ${'v12'}
      ${'fermium'} | ${'v14'}
      ${'GALLIUM'} | ${'v16'}
      ${'v13'}     | ${'v13'}
      ${'bogus'}   | ${'bogus'}
    `('valueToVersion("$value") === $expected', ({ value, expected }) => {
      expect(valueToVersion(value as string)).toBe(expected);
    });
  });
});
