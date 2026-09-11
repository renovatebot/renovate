import { DateTime } from 'luxon';
import { api as nodever } from './index.ts';

describe('modules/versioning/node/index', () => {
  let dtLocal: any;

  beforeEach(() => {
    dtLocal = DateTime.local;
  });

  afterEach(() => {
    DateTime.local = dtLocal;
  });

  it.each`
    currentValue        | rangeStrategy | currentVersion      | newVersion           | expected
    ${'1.0.0'}          | ${'replace'}  | ${'1.0.0'}          | ${'v1.1.0'}          | ${'1.1.0'}
    ${'~8.0.0'}         | ${'replace'}  | ${'8.0.2'}          | ${'v8.2.0'}          | ${'~8.2.0'}
    ${'erbium'}         | ${'replace'}  | ${'12.0.0'}         | ${'v14.1.4'}         | ${'fermium'}
    ${'Fermium'}        | ${'replace'}  | ${'14.0.0'}         | ${'v16.1.6'}         | ${'gallium'}
    ${'gallium'}        | ${'bump'}     | ${'16.0.0'}         | ${'v16.1.6'}         | ${'gallium'}
    ${'gallium'}        | ${'auto'}     | ${'16.1.6'}         | ${'v16.1.6'}         | ${'gallium'}
    ${'27.0.0-alpha.1'} | ${'replace'}  | ${'27.0.0-alpha.1'} | ${'v27.0.0-alpha.2'} | ${'27.0.0-alpha.2'}
    ${'27.0.0-alpha.1'} | ${'replace'}  | ${'27.0.0-alpha.1'} | ${'v27.0.0'}         | ${'27.0.0'}
    ${'gallium'}        | ${'replace'}  | ${'16.0.0'}         | ${'v27.0.0'}         | ${'^27.0.0'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = nodever.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toBe(expected);
    },
  );

  const t1 = DateTime.fromISO('2020-09-01');
  const t2 = DateTime.fromISO('2021-06-01');
  // Node 27 schedule (new shape): alpha 2026-10-28, Current from 2027-04-22,
  // LTS (maintenance) from 2027-10-20.
  const t3 = DateTime.fromISO('2027-06-01'); // Current phase, not yet LTS
  const t4 = DateTime.fromISO('2027-11-01'); // LTS phase

  it.each`
    version             | time  | expected
    ${'16.0.0'}         | ${t1} | ${false}
    ${'15.0.0'}         | ${t1} | ${false}
    ${'14.9.0'}         | ${t1} | ${false}
    ${'14.0.0'}         | ${t2} | ${true}
    ${'12.0.3'}         | ${t1} | ${true}
    ${'v12.0.3'}        | ${t1} | ${true}
    ${'12.0.3a'}        | ${t1} | ${false}
    ${'11.0.0'}         | ${t1} | ${false}
    ${'10.0.0'}         | ${t1} | ${true}
    ${'10.0.999'}       | ${t1} | ${true}
    ${'10.1.0'}         | ${t1} | ${true}
    ${'10.0.0a'}        | ${t1} | ${false}
    ${'9.0.0'}          | ${t1} | ${false}
    ${'1.0.0'}          | ${t1} | ${false}
    ${'27.0.0'}         | ${t3} | ${false}
    ${'27.0.0'}         | ${t4} | ${true}
    ${'v27.0.0'}        | ${t4} | ${true}
    ${'27.0.0-alpha.1'} | ${t4} | ${false}
  `('isStable("$version") === $expected', ({ version, time, expected }) => {
    DateTime.local = (...args: any[]) =>
      args.length ? dtLocal.apply(DateTime, args) : time;
    expect(nodever.isStable(version as string)).toBe(expected);
  });

  it.each`
    version             | expected
    ${'16.0.0'}         | ${true}
    ${'erbium'}         | ${true}
    ${'bogus'}          | ${false}
    ${'^10.0.0'}        | ${true}
    ${'10.x'}           | ${true}
    ${'10.9.8.7'}       | ${false}
    ${'27.0.0-alpha.1'} | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(nodever.isValid(version as string)).toBe(expected);
  });

  it('treats Semver pre-release versions as valid but unstable', () => {
    expect(nodever.isVersion('27.0.0-alpha.1')).toBe(true);
    expect(nodever.isStable('27.0.0-alpha.1')).toBe(false);
    expect(nodever.isGreaterThan('27.0.0', '27.0.0-alpha.1')).toBe(true);
    expect(nodever.isGreaterThan('27.0.0-alpha.2', '27.0.0-alpha.1')).toBe(
      true,
    );
  });

  it.each`
    version     | range        | expected
    ${'16.0.0'} | ${'gallium'} | ${true}
    ${'16.0.0'} | ${'fermium'} | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(nodever.matches(version as string, range as string)).toBe(
        expected,
      );
    },
  );

  it.each`
    versions                          | range        | expected
    ${['16.0.0']}                     | ${'gallium'} | ${'16.0.0'}
    ${['16.0.0', '14.0.0', '16.9.9']} | ${'gallium'} | ${'16.9.9'}
    ${['15.0.0', '14.0.0']}           | ${'gallium'} | ${null}
  `(
    'getSatisfyingVersion("$versions", "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(
        nodever.getSatisfyingVersion(versions as string[], range as string),
      ).toBe(expected);
    },
  );

  it.each`
    versions                          | range        | expected
    ${['16.0.0']}                     | ${'gallium'} | ${'16.0.0'}
    ${['16.0.0', '14.0.0', '16.9.9']} | ${'gallium'} | ${'16.0.0'}
    ${['15.0.0', '14.0.0']}           | ${'gallium'} | ${null}
  `(
    'minSatisfyingVersion("$versions", "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(
        nodever.minSatisfyingVersion(versions as string[], range as string),
      ).toBe(expected);
    },
  );
});
