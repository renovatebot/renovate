import { api as semver } from '.';

describe('modules/versioning/npm/index', () => {
  test.each`
    version                                          | isValid
    ${'17.04.0'}                                     | ${false}
    ${'1.2.3'}                                       | ${true}
    ${'*'}                                           | ${true}
    ${'x'}                                           | ${true}
    ${'X'}                                           | ${true}
    ${'1'}                                           | ${true}
    ${'1.2.3-foo'}                                   | ${true}
    ${'1.2.3foo'}                                    | ${false}
    ${'~1.2.3'}                                      | ${true}
    ${'1.2'}                                         | ${true}
    ${'1.2.x'}                                       | ${true}
    ${'1.2.X'}                                       | ${true}
    ${'1.2.*'}                                       | ${true}
    ${'~1.2.3'}                                      | ${true}
    ${'^1.2.3'}                                      | ${true}
    ${'>1.2.3'}                                      | ${true}
    ${'renovatebot/renovate'}                        | ${false}
    ${'renovatebot/renovate#main'}                   | ${false}
    ${'https://github.com/renovatebot/renovate.git'} | ${false}
  `('isValid("$version") === $isValid', ({ version, isValid }) => {
    const res = semver.isValid(version);
    expect(res).toBe(isValid);
  });

  test.each`
    versions                                          | range      | maxSatisfying
    ${['2.3.3.', '2.3.4', '2.4.5', '2.5.1', '3.0.0']} | ${'*'}     | ${'3.0.0'}
    ${['2.3.3.', '2.3.4', '2.4.5', '2.5.1', '3.0.0']} | ${'x'}     | ${'3.0.0'}
    ${['2.3.3.', '2.3.4', '2.4.5', '2.5.1', '3.0.0']} | ${'X'}     | ${'3.0.0'}
    ${['2.3.3.', '2.3.4', '2.4.5', '2.5.1', '3.0.0']} | ${'2'}     | ${'2.5.1'}
    ${['2.3.3.', '2.3.4', '2.4.5', '2.5.1', '3.0.0']} | ${'2.*'}   | ${'2.5.1'}
    ${['2.3.3.', '2.3.4', '2.4.5', '2.5.1', '3.0.0']} | ${'2.3'}   | ${'2.3.4'}
    ${['2.3.3.', '2.3.4', '2.4.5', '2.5.1', '3.0.0']} | ${'2.3.*'} | ${'2.3.4'}
  `(
    'getSatisfyingVersion("$versions","$range") === $maxSatisfying',
    ({ versions, range, maxSatisfying }) => {
      expect(semver.getSatisfyingVersion(versions, range)).toBe(maxSatisfying);
    }
  );

  test.each`
    version            | isSingle
    ${'1.2.3'}         | ${true}
    ${'1.2.3-alpha.1'} | ${true}
    ${'=1.2.3'}        | ${true}
    ${'= 1.2.3'}       | ${true}
    ${'1.x'}           | ${false}
  `('isSingleVersion("$version") === $isSingle', ({ version, isSingle }) => {
    const res = !!semver.isSingleVersion(version);
    expect(res).toBe(isSingle);
  });

  test.each`
    currentValue            | rangeStrategy        | currentVersion   | newVersion              | expected
    ${'=1.0.0'}             | ${'bump'}            | ${'1.0.0'}       | ${'1.1.0'}              | ${'=1.1.0'}
    ${'^1.0'}               | ${'bump'}            | ${'1.0.0'}       | ${'1.0.7'}              | ${'^1.0'}
    ${'^1'}                 | ${'bump'}            | ${'1.0.0'}       | ${'1.0.7-prerelease.1'} | ${'^1.0.7-prerelease.1'}
    ${'~> 1.0.0'}           | ${'replace'}         | ${'1.0.0'}       | ${'1.1.7'}              | ${'~> 1.1.0'}
    ${'^1.0'}               | ${'bump'}            | ${'1.0.0'}       | ${'1.1.7'}              | ${'^1.1'}
    ${'~1.0'}               | ${'bump'}            | ${'1.0.0'}       | ${'1.1.7'}              | ${'~1.1'}
    ${'~1.0'}               | ${'bump'}            | ${'1.0.0'}       | ${'1.0.7-prerelease.1'} | ${'~1.0.7-prerelease.1'}
    ${'^1'}                 | ${'bump'}            | ${'1.0.0'}       | ${'2.1.7'}              | ${'^2'}
    ${'~1'}                 | ${'bump'}            | ${'1.0.0'}       | ${'1.1.7'}              | ${'~1'}
    ${'5'}                  | ${'bump'}            | ${'5.0.0'}       | ${'5.1.7'}              | ${'5'}
    ${'5'}                  | ${'bump'}            | ${'5.0.0'}       | ${'6.1.7'}              | ${'6'}
    ${'5.0'}                | ${'bump'}            | ${'5.0.0'}       | ${'5.0.7'}              | ${'5.0'}
    ${'5.0'}                | ${'bump'}            | ${'5.0.0'}       | ${'5.1.7'}              | ${'5.1'}
    ${'5.0'}                | ${'bump'}            | ${'5.0.0'}       | ${'6.1.7'}              | ${'6.1'}
    ${'>=1.0.0'}            | ${'bump'}            | ${'1.0.0'}       | ${'1.1.0'}              | ${'>=1.1.0'}
    ${'>= 1.0.0'}           | ${'bump'}            | ${'1.0.0'}       | ${'1.1.0'}              | ${'>= 1.1.0'}
    ${'=1.0.0'}             | ${'replace'}         | ${'1.0.0'}       | ${'1.1.0'}              | ${'=1.1.0'}
    ${'1.0.*'}              | ${'replace'}         | ${'1.0.0'}       | ${'1.1.0'}              | ${'1.1.*'}
    ${'1.*'}                | ${'replace'}         | ${'1.0.0'}       | ${'2.1.0'}              | ${'2.*'}
    ${'~0.6.1'}             | ${'replace'}         | ${'0.6.8'}       | ${'0.7.0-rc.2'}         | ${'~0.7.0-rc'}
    ${'>= 0.1.21 < 0.2.0'}  | ${'bump'}            | ${'0.1.21'}      | ${'0.1.24'}             | ${'>= 0.1.24 < 0.2.0'}
    ${'>= 0.1.21 <= 0.2.0'} | ${'bump'}            | ${'0.1.21'}      | ${'0.1.24'}             | ${'>= 0.1.24 <= 0.2.0'}
    ${'>= 0.0.1 <= 0.1'}    | ${'bump'}            | ${'0.0.1'}       | ${'0.0.2'}              | ${'>= 0.0.2 <= 0.1'}
    ${'>= 0.0.1 < 0.1'}     | ${'bump'}            | ${'0.1.0'}       | ${'0.2.1'}              | ${'>= 0.2.1 < 0.3'}
    ${'>= 0.0.1 < 0.0.4'}   | ${'bump'}            | ${'0.0.4'}       | ${'0.0.5'}              | ${'>= 0.0.5 < 0.0.6'}
    ${'>= 0.0.1 < 1'}       | ${'bump'}            | ${'1.0.0'}       | ${'1.0.1'}              | ${'>= 1.0.1 < 2'}
    ${'>= 0.0.1 < 1'}       | ${'bump'}            | ${'1.0.0'}       | ${'1.0.1'}              | ${'>= 1.0.1 < 2'}
    ${'*'}                  | ${'bump'}            | ${'1.0.0'}       | ${'1.0.1'}              | ${null}
    ${'*'}                  | ${'replace'}         | ${'1.0.0'}       | ${'1.0.1'}              | ${null}
    ${'*'}                  | ${'widen'}           | ${'1.0.0'}       | ${'1.0.1'}              | ${null}
    ${'*'}                  | ${'pin'}             | ${'1.0.0'}       | ${'1.0.1'}              | ${'1.0.1'}
    ${'*'}                  | ${'update-lockfile'} | ${'1.0.0'}       | ${'1.0.1'}              | ${'*'}
    ${'<=1.2.3'}            | ${'widen'}           | ${'1.0.0'}       | ${'1.2.3'}              | ${'<=1.2.3'}
    ${'<=1.2.3'}            | ${'widen'}           | ${'1.0.0'}       | ${'1.2.4'}              | ${'<=1.2.4'}
    ${'>=1.2.3'}            | ${'widen'}           | ${'1.0.0'}       | ${'1.2.3'}              | ${'>=1.2.3'}
    ${'>=1.2.3'}            | ${'widen'}           | ${'1.0.0'}       | ${'1.2.1'}              | ${'>=1.2.3 || 1.2.1'}
    ${'^0.0.3'}             | ${'replace'}         | ${'0.0.3'}       | ${'0.0.6'}              | ${'^0.0.6'}
    ${'^0.0.3'}             | ${'replace'}         | ${'0.0.3'}       | ${'0.5.0'}              | ${'^0.5.0'}
    ${'^0.0.3'}             | ${'replace'}         | ${'0.0.3'}       | ${'0.5.6'}              | ${'^0.5.0'}
    ${'^0.0.3'}             | ${'replace'}         | ${'0.0.3'}       | ${'4.0.0'}              | ${'^4.0.0'}
    ${'^0.0.3'}             | ${'replace'}         | ${'0.0.3'}       | ${'4.0.6'}              | ${'^4.0.0'}
    ${'^0.0.3'}             | ${'replace'}         | ${'0.0.3'}       | ${'4.5.6'}              | ${'^4.0.0'}
    ${'^0.2.0'}             | ${'replace'}         | ${'0.2.0'}       | ${'0.5.6'}              | ${'^0.5.0'}
    ${'^0.2.3'}             | ${'replace'}         | ${'0.2.3'}       | ${'0.5.0'}              | ${'^0.5.0'}
    ${'^0.2.3'}             | ${'replace'}         | ${'0.2.3'}       | ${'0.5.6'}              | ${'^0.5.0'}
    ${'^1.2.3'}             | ${'replace'}         | ${'1.2.3'}       | ${'4.0.0'}              | ${'^4.0.0'}
    ${'^1.2.3'}             | ${'replace'}         | ${'1.2.3'}       | ${'4.5.6'}              | ${'^4.0.0'}
    ${'^1.0.0'}             | ${'replace'}         | ${'1.0.0'}       | ${'4.5.6'}              | ${'^4.0.0'}
    ${'^0.2.3'}             | ${'replace'}         | ${'0.2.3'}       | ${'0.2.4'}              | ${'^0.2.3'}
    ${'^2.3.0'}             | ${'replace'}         | ${'2.3.0'}       | ${'2.4.0'}              | ${'^2.3.0'}
    ${'^2.3.4'}             | ${'replace'}         | ${'2.3.4'}       | ${'2.4.5'}              | ${'^2.3.4'}
    ${'^2.3.4'}             | ${'replace'}         | ${'2.3.4'}       | ${'2.3.5'}              | ${'^2.3.4'}
    ${'~2.3.4'}             | ${'replace'}         | ${'2.3.4'}       | ${'2.3.5'}              | ${'~2.3.0'}
    ${'^0.0.1'}             | ${'replace'}         | ${'0.0.1'}       | ${'0.0.2'}              | ${'^0.0.2'}
    ${'^1.0.1'}             | ${'replace'}         | ${'1.0.1'}       | ${'2.0.2'}              | ${'^2.0.0'}
    ${'^1.2.3'}             | ${'replace'}         | ${'1.2.3'}       | ${'1.2.3'}              | ${'^1.2.3'}
    ${'^1.2.3'}             | ${'replace'}         | ${'1.2.3'}       | ${'1.2.2'}              | ${'^1.2.2'}
    ${'^0.9.21'}            | ${'replace'}         | ${'0.9.21'}      | ${'0.9.22'}             | ${'^0.9.21'}
    ${'1.0.0'}              | ${'pin'}             | ${'1.0.0'}       | ${'1.0.1'}              | ${'1.0.1'}
    ${'1.x'}                | ${'update-lockfile'} | ${'1.0.0'}       | ${'1.0.1'}              | ${'1.x'}
    ${'1.x'}                | ${'update-lockfile'} | ${'1.0.0'}       | ${'2.0.1'}              | ${'2.x'}
    ${'<2.0.0'}             | ${'widen'}           | ${'1.0.0'}       | ${'2.0.1'}              | ${'<3.0.0'}
    ${'1.0.0 - 2.0.0'}      | ${'widen'}           | ${'1.0.0'}       | ${'2.1.0'}              | ${'1.0.0 - 2.1'}
    ${'1.x >2.0.0'}         | ${'widen'}           | ${'1.0.0'}       | ${'2.1.0'}              | ${null}
    ${'^1.0.0'}             | ${'bump'}            | ${'1.0.0'}       | ${'2.0.0'}              | ${'^2.0.0'}
    ${'~1.0.0'}             | ${'bump'}            | ${'1.0.0'}       | ${'2.0.0'}              | ${'~2.0.0'}
    ${'>1.0.0'}             | ${'bump'}            | ${'1.0.0'}       | ${'2.1.0'}              | ${null}
    ${'^1.0.0-alpha'}       | ${'replace'}         | ${'1.0.0-alpha'} | ${'1.0.0-beta'}         | ${'^1.0.0-beta'}
    ${'~1.0.0'}             | ${'replace'}         | ${'1.0.0'}       | ${'1.1.0'}              | ${'~1.1.0'}
    ${'1.0.x'}              | ${'replace'}         | ${'1.0.0'}       | ${'1.1.0'}              | ${'1.1.x'}
    ${'<=1.0'}              | ${'replace'}         | ${'1.0.0'}       | ${'1.2.0'}              | ${'<=1.2'}
    ${'<=1'}                | ${'replace'}         | ${'1.0.0'}       | ${'2.0.0'}              | ${'<=2'}
    ${'<= 1'}               | ${'replace'}         | ${'1.0.0'}       | ${'2.0.0'}              | ${'<= 2'}
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
    }
  );
});
