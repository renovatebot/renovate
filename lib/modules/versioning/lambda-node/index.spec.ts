import { DateTime } from 'luxon';
import type { LambdaData } from './schedule';
import { api as lambdaVer } from '.';

vi.mock('../../../data-files.generated', async (importOriginal) => {
  const dataFiles = (
    await importOriginal<typeof import('../../../data-files.generated')>()
  ).default;

  const lambdaSchedule: LambdaData = JSON.parse(
    dataFiles.get('data/lambda-node-js-schedule.json')!,
  );

  //For this test fixture we're setting `support` to `true` for a specific version to simulate the fact that our datasource
  //doesn't consistently return a date for support date. Likewise, we're removing a known stable node version from the lambda
  //schedule to simulate the time period where there's a released LTS version that AWS hasn't released as a Lambda Runtime
  //yet.
  const scheduleWithSupportTrue = JSON.stringify({
    ...lambdaSchedule,
    '20': {
      ...lambdaSchedule['20'],
      support: true,
    },
    '22': undefined,
  });

  const mockDataFiles = new Map(dataFiles);
  mockDataFiles.set(
    'data/lambda-node-js-schedule.json',
    scheduleWithSupportTrue,
  );

  return {
    default: mockDataFiles,
  };
});

describe('modules/versioning/lambda-node/index', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  beforeEach(() => {
    vi.setSystemTime(DateTime.fromISO('2021-03-20').valueOf());
  });

  it.each`
    currentValue | rangeStrategy | currentVersion | newVersion   | expected
    ${'1.0.0'}   | ${'replace'}  | ${'1.0.0'}     | ${'v1.1.0'}  | ${'1.1.0'}
    ${'~8.0.0'}  | ${'replace'}  | ${'8.0.2'}     | ${'v8.2.0'}  | ${'~8.2.0'}
    ${'erbium'}  | ${'replace'}  | ${'12.0.0'}    | ${'v14.1.4'} | ${'fermium'}
    ${'Fermium'} | ${'replace'}  | ${'14.0.0'}    | ${'v16.1.6'} | ${'gallium'}
    ${'gallium'} | ${'pin'}      | ${'16.1.6'}    | ${'v16.1.6'} | ${'16.1.6'}
    ${'gallium'} | ${'bump'}     | ${'16.0.0'}    | ${'v16.1.6'} | ${'gallium'}
    ${'gallium'} | ${'auto'}     | ${'16.1.6'}    | ${'v16.1.6'} | ${'gallium'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = lambdaVer.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toBe(expected);
    },
  );

  const t1 = DateTime.fromISO('2025-03-01');
  const t2 = DateTime.fromISO('2024-03-01');

  it.each`
    version       | time  | expected
    ${`v22.0.0`}  | ${t1} | ${false}
    ${`v20.0.0`}  | ${t1} | ${true}
    ${`Iron`}     | ${t1} | ${false}
    ${'v18.0.3'}  | ${t1} | ${true}
    ${'v18.0.0'}  | ${t1} | ${true}
    ${'18.0.0'}   | ${t1} | ${true}
    ${'18.0.0a'}  | ${t1} | ${false}
    ${'16.0.0'}   | ${t2} | ${true}
    ${'16.0.0'}   | ${t1} | ${false}
    ${'15.0.0'}   | ${t1} | ${false}
    ${'14.9.0'}   | ${t1} | ${false}
    ${'14.0.0'}   | ${t1} | ${false}
    ${'12.0.3'}   | ${t1} | ${false}
    ${'v12.0.3'}  | ${t1} | ${false}
    ${'12.0.3a'}  | ${t1} | ${false}
    ${'11.0.0'}   | ${t1} | ${false}
    ${'10.0.0'}   | ${t1} | ${false}
    ${'10.0.999'} | ${t1} | ${false}
    ${'10.1.0'}   | ${t1} | ${false}
    ${'10.0.0a'}  | ${t1} | ${false}
    ${'9.0.0'}    | ${t1} | ${false}
  `('isStable("$version") === $expected', ({ version, time, expected }) => {
    vi.setSystemTime(time);

    expect(lambdaVer.isStable(version as string)).toBe(expected);
  });

  it.each`
    version       | expected
    ${'16.0.0'}   | ${true}
    ${'erbium'}   | ${true}
    ${'bogus'}    | ${false}
    ${'^10.0.0'}  | ${true}
    ${'10.x'}     | ${true}
    ${'10.9.8.7'} | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(lambdaVer.isValid(version as string)).toBe(expected);
  });

  it.each`
    version     | range        | expected
    ${'16.0.0'} | ${'gallium'} | ${true}
    ${'16.0.0'} | ${'fermium'} | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(lambdaVer.matches(version as string, range as string)).toBe(
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
        lambdaVer.getSatisfyingVersion(versions as string[], range as string),
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
        lambdaVer.minSatisfyingVersion(versions as string[], range as string),
      ).toBe(expected);
    },
  );
});
