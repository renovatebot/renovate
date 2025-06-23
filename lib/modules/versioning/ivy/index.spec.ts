import {
  REV_TYPE_LATEST,
  REV_TYPE_RANGE,
  REV_TYPE_SUBREV,
  parseDynamicRevision,
} from './parse';
import ivy from '.';

describe('modules/versioning/ivy/index', () => {
  it.each`
    input                   | type               | value
    ${'latest'}             | ${REV_TYPE_LATEST} | ${''}
    ${'latest.release'}     | ${REV_TYPE_LATEST} | ${'release'}
    ${'latest.milestone'}   | ${REV_TYPE_LATEST} | ${'milestone'}
    ${'latest.integration'} | ${REV_TYPE_LATEST} | ${''}
    ${'1.0.+'}              | ${REV_TYPE_SUBREV} | ${'1.0'}
    ${'1.2.3.+'}            | ${REV_TYPE_SUBREV} | ${'1.2.3'}
    ${'[1.0,2.0]'}          | ${REV_TYPE_RANGE}  | ${'[1.0,2.0]'}
    ${'[1.0,2.0['}          | ${REV_TYPE_RANGE}  | ${'[1.0,2.0['}
    ${']1.0,2.0]'}          | ${REV_TYPE_RANGE}  | ${']1.0,2.0]'}
    ${']1.0,2.0['}          | ${REV_TYPE_RANGE}  | ${']1.0,2.0['}
    ${'[1.0,)'}             | ${REV_TYPE_RANGE}  | ${'[1.0,)'}
    ${']1.0,)'}             | ${REV_TYPE_RANGE}  | ${']1.0,)'}
    ${'(,2.0]'}             | ${REV_TYPE_RANGE}  | ${'(,2.0]'}
    ${'(,2.0['}             | ${REV_TYPE_RANGE}  | ${'(,2.0['}
  `(
    'parseDynamicRevision("$input") === { type: "$type", value: "$value" }',
    ({ input, type, value }) => {
      expect(parseDynamicRevision(input)).toEqual({ type, value });
    },
  );

  it.each`
    input
    ${null}
    ${''}
    ${'.+'}
    ${'[0,1),(1,)'}
  `('parseDynamicRevision("$input") === null', ({ input, type, value }) => {
    expect(parseDynamicRevision(value)).toBeNull();
  });

  it.each`
    input                   | expected
    ${''}                   | ${false}
    ${'1.0.0'}              | ${true}
    ${'0'}                  | ${true}
    ${'0.1-2-sp'}           | ${true}
    ${'1-final'}            | ${true}
    ${'v1.0.0'}             | ${true}
    ${'x1.0.0'}             | ${true}
    ${'2.1.1.RELEASE'}      | ${true}
    ${'Greenwich.SR1'}      | ${true}
    ${'.1'}                 | ${false}
    ${'1.'}                 | ${false}
    ${'-1'}                 | ${false}
    ${'1-'}                 | ${false}
    ${'latest'}             | ${true}
    ${'latest.release'}     | ${true}
    ${'latest.milestone'}   | ${true}
    ${'latest.integration'} | ${true}
    ${'1.0.+'}              | ${true}
    ${'1.0+'}               | ${false}
    ${']0,1['}              | ${true}
    ${'[0,1]'}              | ${true}
    ${'[0,1),(1,2]'}        | ${false}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    const res = !!ivy.isValid(input);
    expect(res).toBe(expected);
  });

  it.each`
    input                   | expected
    ${''}                   | ${false}
    ${'1.0.0'}              | ${true}
    ${'0'}                  | ${true}
    ${'0.1-2-sp'}           | ${true}
    ${'1-final'}            | ${true}
    ${'v1.0.0'}             | ${true}
    ${'x1.0.0'}             | ${true}
    ${'2.1.1.RELEASE'}      | ${true}
    ${'Greenwich.SR1'}      | ${true}
    ${'.1'}                 | ${false}
    ${'1.'}                 | ${false}
    ${'-1'}                 | ${false}
    ${'1-'}                 | ${false}
    ${'latest'}             | ${false}
    ${'latest.release'}     | ${false}
    ${'latest.milestone'}   | ${false}
    ${'latest.integration'} | ${false}
    ${'1.0.+'}              | ${false}
    ${'1.0+'}               | ${false}
    ${']0,1['}              | ${false}
    ${'[0,1]'}              | ${false}
    ${'[0,1),(1,2]'}        | ${false}
  `('isVersion("$input") === $expected', ({ input, expected }) => {
    expect(ivy.isVersion(input)).toBe(expected);
  });

  it.each`
    version            | range                   | expected
    ${''}              | ${'latest'}             | ${false}
    ${'0'}             | ${''}                   | ${false}
    ${'0'}             | ${'latest'}             | ${true}
    ${'0'}             | ${'latest.integration'} | ${true}
    ${'0'}             | ${'latest.release'}     | ${false}
    ${'release'}       | ${'latest.release'}     | ${true}
    ${'0.release'}     | ${'latest.release'}     | ${true}
    ${'0-release'}     | ${'latest.release'}     | ${true}
    ${'0release'}      | ${'latest.release'}     | ${true}
    ${'0.RELEASE'}     | ${'latest.release'}     | ${true}
    ${'0'}             | ${'latest.milestone'}   | ${false}
    ${'milestone'}     | ${'latest.milestone'}   | ${true}
    ${'0.milestone'}   | ${'latest.milestone'}   | ${true}
    ${'0-milestone'}   | ${'latest.milestone'}   | ${true}
    ${'0milestone'}    | ${'latest.milestone'}   | ${true}
    ${'0.MILESTONE'}   | ${'latest.milestone'}   | ${true}
    ${'0'}             | ${'1.0.+'}              | ${false}
    ${'1.1.0'}         | ${'1.2.+'}              | ${false}
    ${'1.2.0'}         | ${'1.2.+'}              | ${true}
    ${'1.2.milestone'} | ${'1.2.+'}              | ${true}
    ${'1.3'}           | ${'1.2.+'}              | ${false}
    ${'1'}             | ${'1'}                  | ${true}
    ${'1'}             | ${'0'}                  | ${false}
    ${'1'}             | ${'[0,1]'}              | ${true}
    ${'0'}             | ${'(0,1)'}              | ${false}
    ${'0'}             | ${'(0,1['}              | ${false}
    ${'0'}             | ${']0,1)'}              | ${false}
    ${'1'}             | ${'(0,1)'}              | ${false}
    ${'1'}             | ${'(0,2)'}              | ${true}
    ${'1'}             | ${'[0,2]'}              | ${true}
    ${'1'}             | ${'(,1]'}               | ${true}
    ${'1'}             | ${'(,1)'}               | ${false}
    ${'1'}             | ${'[1,)'}               | ${true}
    ${'1'}             | ${'(1,)'}               | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(ivy.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    currentValue             | rangeStrategy | currentVersion | newVersion  | expected
    ${'1'}                   | ${'auto'}     | ${'1'}         | ${'1.1'}    | ${'1.1'}
    ${'[1.2.3,]'}            | ${'auto'}     | ${'1.2.3'}     | ${'1.2.4'}  | ${'[1.2.3,]'}
    ${'[1.2.3]'}             | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.0.0,1.2.3]'}       | ${'pin'}      | ${'1.0.0'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.0.0,1.2.23]'}      | ${'pin'}      | ${'1.0.0'}     | ${'1.2.23'} | ${'1.2.23'}
    ${'(,1.0]'}              | ${'pin'}      | ${'0.0.1'}     | ${'2.0'}    | ${'2.0'}
    ${'],1.0]'}              | ${'pin'}      | ${'0.0.1'}     | ${'2.0'}    | ${'2.0'}
    ${'(,1.0)'}              | ${'pin'}      | ${'0.1'}       | ${'2.0'}    | ${'2.0'}
    ${'],1.0['}              | ${'pin'}      | ${'2.0'}       | ${'],2.0['} | ${'],2.0['}
    ${'[1.0,1.2],[1.3,1.5)'} | ${'pin'}      | ${'1.0'}       | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.0,1.2],[1.3,1.5['} | ${'pin'}      | ${'1.0'}       | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.2.3,)'}            | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.2.3,['}            | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'latest.integration'}  | ${'pin'}      | ${'1.0'}       | ${'2.0'}    | ${'2.0'}
    ${'latest'}              | ${'pin'}      | ${'1.0'}       | ${'2.0'}    | ${'2.0'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = ivy.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(expected);
    },
  );

  it.each`
    versions           | range     | expected
    ${['0', '1', '2']} | ${'(,2)'} | ${'1'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(ivy.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    version    | expected
    ${'1.2.0'} | ${true}
  `('isCompatible("$version") === $expected', ({ version, expected }) => {
    expect(ivy.isCompatible(version)).toBe(expected);
  });

  it.each`
    version     | expected
    ${'1.2.0'}  | ${true}
    ${'^1.2.0'} | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(ivy.isSingleVersion(version)).toBe(expected);
  });
});
