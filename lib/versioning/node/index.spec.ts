import { DateTime } from 'luxon';
import { api as nodever } from '.';

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
      ${'gallium'} | ${'pin'}      | ${'16.0.0'}    | ${'v16.1.6'} | ${'16.1.6'}
      ${'gallium'} | ${'bump'}     | ${'16.0.0'}    | ${'v16.1.6'} | ${'gallium'}
      ${'gallium'} | ${'auto'}     | ${'16.0.0'}    | ${'v16.1.6'} | ${'gallium'}
    `(
      '($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
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
    `('("$version") === $expected', ({ version, time, expected }) => {
      DateTime.local = (...args: (string | any)[]) =>
        args.length ? dtLocal.apply(DateTime, args) : time;
      expect(nodever.isStable(version as string)).toBe(expected);
    });
  });

  describe('isValid', () => {
    test.each`
      version       | expected
      ${'16.0.0'}   | ${true}
      ${'erbium'}   | ${true}
      ${'bogus'}    | ${false}
      ${'^10.0.0'}  | ${true}
      ${'10.x'}     | ${true}
      ${'10.9.8.7'} | ${false}
    `('("$version") === $expected', ({ version, expected }) => {
      expect(nodever.isValid(version as string)).toBe(expected);
    });
  });

  describe('matches', () => {
    test.each`
      version     | range        | expected
      ${'16.0.0'} | ${'gallium'} | ${true}
      ${'16.0.0'} | ${'fermium'} | ${false}
    `('("$version","$range") === $expected', ({ version, range, expected }) => {
      expect(nodever.matches(version as string, range as string)).toBe(
        expected
      );
    });
  });

  describe('getSatisfyingVersion', () => {
    test.each`
      versions                          | range        | expected
      ${['16.0.0']}                     | ${'gallium'} | ${'16.0.0'}
      ${['16.0.0', '14.0.0', '16.9.9']} | ${'gallium'} | ${'16.9.9'}
      ${['15.0.0', '14.0.0']}           | ${'gallium'} | ${null}
    `(
      '("$versions","$range") === $expected',
      ({ versions, range, expected }) => {
        expect(
          nodever.getSatisfyingVersion(versions as string[], range as string)
        ).toBe(expected);
      }
    );
  });

  describe('minSatisfyingVersion', () => {
    test.each`
      versions                          | range        | expected
      ${['16.0.0']}                     | ${'gallium'} | ${'16.0.0'}
      ${['16.0.0', '14.0.0', '16.9.9']} | ${'gallium'} | ${'16.0.0'}
      ${['15.0.0', '14.0.0']}           | ${'gallium'} | ${null}
    `(
      '("$versions","$range") === $expected',
      ({ versions, range, expected }) => {
        expect(
          nodever.minSatisfyingVersion(versions as string[], range as string)
        ).toBe(expected);
      }
    );
  });
});
