import semver from '.';

describe('modules/versioning/semver/index', () => {
  it.each`
    version                                          | expected
    ${'17.04.0'}                                     | ${false}
    ${'1.2.3'}                                       | ${true}
    ${'1.2.3-foo'}                                   | ${true}
    ${'1.2.3foo'}                                    | ${false}
    ${'~1.2.3'}                                      | ${false}
    ${'^1.2.3'}                                      | ${false}
    ${'>1.2.3'}                                      | ${false}
    ${'renovatebot/renovate'}                        | ${false}
    ${'renovatebot/renovate#master'}                 | ${false}
    ${'https://github.com/renovatebot/renovate.git'} | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!semver.isValid(version)).toBe(expected);
  });

  it.each`
    version            | expected
    ${'1.2.3'}         | ${true}
    ${'1.2.3-alpha.1'} | ${true}
    ${'=1.2.3'}        | ${false}
    ${'= 1.2.3'}       | ${false}
    ${'1.x'}           | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!semver.isSingleVersion(version)).toBe(expected);
  });

  it.each`
    currentValue | rangeStrategy | currentVersion | newVersion  | expected
    ${'=1.0.0'}  | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}  | ${'1.1.0'}
    ${'1.0.0'}   | ${'auto'}     | ${'v1.0.0'}    | ${'v2.0.0'} | ${'2.0.0'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = semver.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(expected);
    },
  );

  it.each`
    currentVersion     | newVersion         | expected
    ${'0.0.1'}         | ${'0.0.2'}         | ${true}
    ${'0.0.1'}         | ${'0.2.0'}         | ${true}
    ${'0.0.1'}         | ${'1.0.0'}         | ${true}
    ${'1.0.0-alpha.1'} | ${'1.0.0'}         | ${true}
    ${'1.0.0-alpha.1'} | ${'1.0.0-alpha.2'} | ${true}
    ${'1.0.0'}         | ${'2.0.0-alpha.1'} | ${true}
    ${'1.0.0'}         | ${'1.0.0'}         | ${false}
    ${'1.0.0'}         | ${'2.0.0'}         | ${true}
    ${'2.0.0'}         | ${'2.0.1'}         | ${false}
    ${'2.0.0'}         | ${'2.1.0'}         | ${false}
  `(
    'isBreaking("$currentVersion", "$newVersion") === $expected',
    ({ currentVersion, newVersion, expected }) => {
      expect(semver.isBreaking!(currentVersion, newVersion)).toBe(expected);
    },
  );

  it.each`
    version    | expected
    ${'1.2.0'} | ${true}
  `('isCompatible("$version") === $expected', ({ version, expected }) => {
    expect(semver.isCompatible(version)).toBe(expected);
  });
});
