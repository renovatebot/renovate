import { api as versioning } from '.';

describe('modules/versioning/poetry/index', () => {
  describe('equals', () => {
    it.each`
      a                | b                 | expected
      ${'1'}           | ${'1'}            | ${true}
      ${'1.0'}         | ${'1'}            | ${true}
      ${'1.0.0'}       | ${'1'}            | ${true}
      ${'1.9.0'}       | ${'1.9'}          | ${true}
      ${'1'}           | ${'2'}            | ${false}
      ${'1.9.1'}       | ${'1.9'}          | ${false}
      ${'1.9-beta'}    | ${'1.9'}          | ${false}
      ${'1.9b0'}       | ${'1.9'}          | ${false}
      ${'1.9b0'}       | ${'1.9.0-beta.0'} | ${true}
      ${'1.9.01b01'}   | ${'1.9.1-beta.1'} | ${true}
      ${'1.9-0'}       | ${'1.9.0-post.0'} | ${true}
      ${'1.9.0-post'}  | ${'1.9.0-post.0'} | ${true}
      ${'1.9.01-post'} | ${'1.9.1-post.0'} | ${true}
      ${'1.9.0dev0'}   | ${'1.9.0-dev.0'}  | ${true}
      ${'1.9.01pre'}   | ${'1.9.1-pre'}    | ${true}
      ${'1.9.pre'}     | ${'1.9.pre'}      | ${true}
    `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(versioning.equals(a, b)).toBe(expected);
    });
  });

  it.each`
    version          | major   | minor   | patch
    ${'1'}           | ${1}    | ${0}    | ${0}
    ${'1.9'}         | ${1}    | ${9}    | ${0}
    ${'1.9.0'}       | ${1}    | ${9}    | ${0}
    ${'1.9.4'}       | ${1}    | ${9}    | ${4}
    ${'1.9.4b0'}     | ${1}    | ${9}    | ${4}
    ${'1.9.4-beta0'} | ${1}    | ${9}    | ${4}
    ${'17.04.01'}    | ${17}   | ${4}    | ${1}
    ${'!@#'}         | ${null} | ${null} | ${null}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(versioning.getMajor(version)).toBe(major);
      expect(versioning.getMinor(version)).toBe(minor);
      expect(versioning.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    a           | b             | expected
    ${'2'}      | ${'1'}        | ${true}
    ${'2.0'}    | ${'1'}        | ${true}
    ${'2.0.0'}  | ${'1'}        | ${true}
    ${'1.10.0'} | ${'1.9'}      | ${true}
    ${'1.9'}    | ${'1.9-beta'} | ${true}
    ${'1.9'}    | ${'1.9a0'}    | ${true}
    ${'1'}      | ${'1'}        | ${false}
    ${'1.0'}    | ${'1'}        | ${false}
    ${'1.0.0'}  | ${'1'}        | ${false}
    ${'1.9.0'}  | ${'1.9'}      | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(versioning.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    version         | expected
    ${'1'}          | ${true}
    ${'1.9'}        | ${true}
    ${'1.9.0'}      | ${true}
    ${'1.9.4'}      | ${true}
    ${'1.9.4-beta'} | ${false}
    ${'1.9.4a0'}    | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    const res = !!versioning.isStable(version);
    expect(res).toBe(expected);
  });

  it.each`
    version        | expected
    ${'1.2.3a0'}   | ${true}
    ${'1.2.3b1'}   | ${true}
    ${'1.2.3rc23'} | ${true}
    ${'17.04.01'}  | ${true}
    ${'17.b4.0'}   | ${false}
    ${'0.98.5.1'}  | ${false}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!versioning.isVersion(version)).toBe(expected);
  });

  it.each`
    version                                          | expected
    ${null}                                          | ${false}
    ${undefined}                                     | ${false}
    ${'17.04.00'}                                    | ${true}
    ${'17.b4.0'}                                     | ${false}
    ${'1.2.3'}                                       | ${true}
    ${'1.2.3-foo'}                                   | ${true}
    ${'1.2.3foo'}                                    | ${false}
    ${'1.2.3a0'}                                     | ${true}
    ${'1.2.3b1'}                                     | ${true}
    ${'1.2.3rc23'}                                   | ${true}
    ${'*'}                                           | ${true}
    ${'~1.2.3'}                                      | ${true}
    ${'^1.2.3'}                                      | ${true}
    ${'>1.2.3'}                                      | ${true}
    ${'~=1.9'}                                       | ${true}
    ${'==1.9'}                                       | ${true}
    ${'===1.9.4'}                                    | ${true}
    ${'renovatebot/renovate'}                        | ${false}
    ${'renovatebot/renovate#master'}                 | ${false}
    ${'https://github.com/renovatebot/renovate.git'} | ${false}
    ${'>=2.6, !=3.0.*, !=3.1.*, !=3.2.*, <4'}        | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!versioning.isValid(version)).toBe(expected);
  });

  it.each`
    version            | expected
    ${'1.2.3'}         | ${true}
    ${'1.2.3-alpha.1'} | ${true}
    ${'=1.2.3'}        | ${true}
    ${'= 1.2.3'}       | ${true}
    ${'1.*'}           | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!versioning.isSingleVersion(version)).toBe(expected);
  });

  it.each`
    version      | range                     | expected
    ${'4.2.0'}   | ${'4.2, >= 3.0, < 5.0.0'} | ${true}
    ${'4.2.0'}   | ${'2.0, >= 3.0, < 5.0.0'} | ${false}
    ${'4.2.2'}   | ${'4.2.0, < 4.2.4'}       | ${false}
    ${'4.2.2'}   | ${'^4.2.0, < 4.2.4'}      | ${true}
    ${'4.2.0'}   | ${'4.3.0, 3.0.0'}         | ${false}
    ${'4.2.0'}   | ${'> 5.0.0, <= 6.0.0'}    | ${false}
    ${'4.2.0'}   | ${'*'}                    | ${true}
    ${'1.9.4'}   | ${'==1.9'}                | ${true}
    ${'1.9.4'}   | ${'===1.9.4'}             | ${true}
    ${'1.9.4'}   | ${'===1.9.3'}             | ${false}
    ${'0.8.0a1'} | ${'^0.8.0-alpha.0'}       | ${true}
    ${'0.7.4'}   | ${'^0.8.0-alpha.0'}       | ${false}
    ${'1.4'}     | ${'1.4'}                  | ${true}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(versioning.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    version    | range                  | expected
    ${'0.9.0'} | ${'>= 1.0.0 <= 2.0.0'} | ${true}
    ${'1.9.0'} | ${'>= 1.0.0 <= 2.0.0'} | ${false}
  `(
    'isLessThanRange("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(versioning.isLessThanRange?.(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                                         | range                          | expected
    ${['0.4.0', '0.5.0', '4.2.0', '4.3.0', '5.0.0']} | ${'4.*, > 4.2'}                | ${'4.3.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^4.0.0'}                    | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^4.0.0, = 0.5.0'}           | ${null}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^4.0.0, > 4.1.0, <= 4.3.5'} | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^6.2.0, 3.*'}               | ${null}
    ${['0.8.0a2', '0.8.0a7']}                        | ${'^0.8.0-alpha.0'}            | ${'0.8.0-alpha.2'}
    ${['1.0.0', '2.0.0']}                            | ${'^3.0.0'}                    | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(versioning.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                                                  | range               | expected
    ${['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']} | ${'4.*.0, < 4.2.5'} | ${'4.2.1'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0', '5.0.3']} | ${'5.0, > 5.0.0'}   | ${'5.0.3'}
    ${['0.8.0a2', '0.8.0a7']}                                 | ${'^0.8.0-alpha.0'} | ${'0.8.0-alpha.7'}
    ${['1.0.0', '2.0.0']}                                     | ${'^3.0.0'}         | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(versioning.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    currentValue        | rangeStrategy | currentVersion     | newVersion         | expected
    ${'1.0.0'}          | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'1.1.0'}
    ${'   1.0.0'}       | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'1.1.0'}
    ${'1.0.0'}          | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'1.1.0'}
    ${'=1.0.0'}         | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'=1.1.0'}
    ${'=  1.0.0'}       | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'=1.1.0'}
    ${'= 1.0.0'}        | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'=1.1.0'}
    ${'  = 1.0.0'}      | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'=1.1.0'}
    ${'  =   1.0.0'}    | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'=1.1.0'}
    ${'=    1.0.0'}     | ${'bump'}     | ${'1.0.0'}         | ${'1.1.0'}         | ${'=1.1.0'}
    ${'^1.0'}           | ${'bump'}     | ${'1.0.0'}         | ${'1.0.7'}         | ${'^1.0.7'}
    ${'^1.0.0'}         | ${'replace'}  | ${'1.0.0'}         | ${'2.0.7'}         | ${'^2.0.0'}
    ${'^5.0.3'}         | ${'replace'}  | ${'5.3.1'}         | ${'5.5'}           | ${'^5.0.3'}
    ${'1.0.0'}          | ${'replace'}  | ${'1.0.0'}         | ${'2.0.7'}         | ${'2.0.7'}
    ${'^1.0.0'}         | ${'replace'}  | ${'1.0.0'}         | ${'2.0.7'}         | ${'^2.0.0'}
    ${'^0.5.15'}        | ${'replace'}  | ${'0.5.15'}        | ${'0.6'}           | ${'^0.5.15'}
    ${'^0.5.15'}        | ${'replace'}  | ${'0.5.15'}        | ${'0.6b.4'}        | ${'^0.5.15'}
    ${'^1'}             | ${'bump'}     | ${'1.0.0'}         | ${'2.1.7'}         | ${'^2.1.7'}
    ${'~1'}             | ${'bump'}     | ${'1.0.0'}         | ${'1.1.7'}         | ${'~1.1.7'}
    ${'5'}              | ${'bump'}     | ${'5.0.0'}         | ${'5.1.7'}         | ${'5.1.7'}
    ${'5'}              | ${'bump'}     | ${'5.0.0'}         | ${'6.1.7'}         | ${'6.1.7'}
    ${'5.0'}            | ${'bump'}     | ${'5.0.0'}         | ${'5.0.7'}         | ${'5.0.7'}
    ${'5.0'}            | ${'bump'}     | ${'5.0.0'}         | ${'5.1.7'}         | ${'5.1.7'}
    ${'5.0'}            | ${'bump'}     | ${'5.0.0'}         | ${'6.1.7'}         | ${'6.1.7'}
    ${'5.0'}            | ${'bump'}     | ${'5.0.0'}         | ${'6.b0.0'}        | ${'5.0'}
    ${'5.0'}            | ${'replace'}  | ${'5.0.0'}         | ${'6.1.7'}         | ${'6.1'}
    ${'=1.0.0'}         | ${'replace'}  | ${'1.0.0'}         | ${'1.1.0'}         | ${'=1.1.0'}
    ${'^1'}             | ${'bump'}     | ${'1.0.0'}         | ${'1.0.7rc.1'}     | ${'^1.0.7-rc.1'}
    ${'^1'}             | ${'bump'}     | ${'1.0.0'}         | ${'1.0.7a0'}       | ${'^1.0.7-alpha.0'}
    ${'^0.8.0-alpha.0'} | ${'bump'}     | ${'0.8.0-alpha.0'} | ${'0.8.0-alpha.1'} | ${'^0.8.0-alpha.1'}
    ${'^0.8.0-alpha.0'} | ${'bump'}     | ${'0.8.0-alpha.0'} | ${'0.8.0a1'}       | ${'^0.8.0-alpha.1'}
    ${'^1.0.0'}         | ${'replace'}  | ${'1.0.0'}         | ${'1.2.3'}         | ${'^1.0.0'}
    ${'~1.0'}           | ${'bump'}     | ${'1.0.0'}         | ${'1.1.7'}         | ${'~1.1.7'}
    ${'1.0.*'}          | ${'replace'}  | ${'1.0.0'}         | ${'1.1.0'}         | ${'1.1.*'}
    ${'1.*'}            | ${'replace'}  | ${'1.0.0'}         | ${'2.1.0'}         | ${'2.*'}
    ${'~0.6.1'}         | ${'replace'}  | ${'0.6.8'}         | ${'0.7.0-rc.2'}    | ${'~0.7.0-rc'}
    ${'<1.3.4'}         | ${'replace'}  | ${'1.2.3'}         | ${'1.5.0'}         | ${'<1.5.1'}
    ${'< 1.3.4'}        | ${'replace'}  | ${'1.2.3'}         | ${'1.5.0'}         | ${'< 1.5.1'}
    ${'<   1.3.4'}      | ${'replace'}  | ${'1.2.3'}         | ${'1.5.0'}         | ${'< 1.5.1'}
    ${'<=1.3.4'}        | ${'replace'}  | ${'1.2.3'}         | ${'1.5.0'}         | ${'<=1.5.0'}
    ${'<= 1.3.4'}       | ${'replace'}  | ${'1.2.3'}         | ${'1.5.0'}         | ${'<= 1.5.0'}
    ${'<=   1.3.4'}     | ${'replace'}  | ${'1.2.3'}         | ${'1.5.0'}         | ${'<= 1.5.0'}
    ${'^1.2'}           | ${'replace'}  | ${'1.2.3'}         | ${'2.0.0'}         | ${'^2.0'}
    ${'^1'}             | ${'replace'}  | ${'1.2.3'}         | ${'2.0.0'}         | ${'^2'}
    ${'~1.2'}           | ${'replace'}  | ${'1.2.3'}         | ${'2.0.0'}         | ${'~2.0'}
    ${'~1'}             | ${'replace'}  | ${'1.2.3'}         | ${'2.0.0'}         | ${'~2'}
    ${'^2.2'}           | ${'widen'}    | ${'2.2.0'}         | ${'3.0.0'}         | ${'^2.2 || ^3.0.0'}
    ${'^2.2 || ^3.0.0'} | ${'widen'}    | ${'3.0.0'}         | ${'4.0.0'}         | ${'^2.2 || ^3.0.0 || ^4.0.0'}
    ${'^3.5'}           | ${'pin'}      | ${'3.5'}           | ${'3.5'}           | ${'3.5'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = versioning.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(expected);
    },
  );

  it.each`
    a           | b             | expected
    ${'2'}      | ${'1'}        | ${1}
    ${'2.0'}    | ${'1'}        | ${1}
    ${'2.0.0'}  | ${'1'}        | ${1}
    ${'1.10.0'} | ${'1.9'}      | ${1}
    ${'1.9'}    | ${'1.9-beta'} | ${1}
    ${'1'}      | ${'1'}        | ${0}
    ${'1.0'}    | ${'1'}        | ${0}
    ${'1.0.0'}  | ${'1'}        | ${0}
    ${'1.9.0'}  | ${'1.9'}      | ${0}
    ${'1.9'}    | ${'1.9b'}     | ${1}
    ${'1.9'}    | ${'1.9rc0'}   | ${1}
  `('sortVersions("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(versioning.sortVersions(a, b)).toEqual(expected);
  });
});

it.each`
  a                     | b                     | expected
  ${'1.0.0'}            | ${'1.0.0'}            | ${true}
  ${'1.0.0'}            | ${'>=1.0.0'}          | ${true}
  ${'1.1.0'}            | ${'^1.0.0'}           | ${true}
  ${'>=1.0.0'}          | ${'>=1.0.0'}          | ${true}
  ${'~1.0.0'}           | ${'~1.0.0'}           | ${true}
  ${'^1.0.0'}           | ${'^1.0.0'}           | ${true}
  ${'>=1.0.0'}          | ${'>=1.1.0'}          | ${false}
  ${'~1.0.0'}           | ${'~1.1.0'}           | ${false}
  ${'^1.0.0'}           | ${'^1.1.0'}           | ${false}
  ${'>=1.0.0'}          | ${'<1.0.0'}           | ${false}
  ${'~1.0.0'}           | ${'~0.9.0'}           | ${false}
  ${'^1.0.0'}           | ${'^0.9.0'}           | ${false}
  ${'^1.1.0 || ^2.0.0'} | ${'^1.0.0 || ^2.0.0'} | ${true}
  ${'^1.0.0 || ^2.0.0'} | ${'^1.1.0 || ^2.0.0'} | ${false}
`('subset("$a", "$b") === $expected', ({ a, b, expected }) => {
  expect(versioning.subset!(a, b)).toBe(expected);
});
