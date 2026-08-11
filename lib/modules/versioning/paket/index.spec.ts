import paket from './index.ts';

describe('modules/versioning/paket/index', () => {
  describe('isValid()', () => {
    it.each`
      input                    | expected
      ${'1.2.3'}               | ${true}
      ${'1.2.3.4'}             | ${true}
      ${'1.2.3-alpha001'}      | ${true}
      ${'= 1.2.3'}             | ${true}
      ${'== 1.2.3'}            | ${true}
      ${'>= 1.2.3'}            | ${true}
      ${'> 1'}                 | ${true}
      ${'< 1.5'}               | ${true}
      ${'<= 1.5.0'}            | ${true}
      ${'~> 1.2.3'}            | ${true}
      ${'>= 1.2.3 < 1.5'}      | ${true}
      ${'>= 1.2.3 <   1.5'}    | ${true}
      ${'>= 1.2.3 <= 1.5'}     | ${true}
      ${'> 1.2.3 < 1.5'}       | ${true}
      ${'> 1.2.3 <= 1.5'}      | ${true}
      ${'~> 1.2 >= 1.2.3'}     | ${true}
      ${'~> 1.2 > 1.2.3'}      | ${true}
      ${'~> 1.2 < 1.4.1'}      | ${true}
      ${'~> 1.2 <= 1.4.1'}     | ${true}
      ${'>= 1.2.3 alpha'}      | ${true}
      ${'>= 1.2.3 alpha beta'} | ${true}
      ${'>= 1 alpha alpha'}    | ${true}
      ${'~> 1.2 prerelease'}   | ${true}
      ${'!~> 1.2'}             | ${true}
      ${'@~> 1.2'}             | ${true}
      ${'!1.2.3'}              | ${true}
      ${'! ~> 1.2'}            | ${true}
      ${''}                    | ${false}
      ${'  '}                  | ${false}
      ${'abc'}                 | ${false}
      ${'1.2.3.4.5'}           | ${false}
      ${'>='}                  | ${false}
      ${'>= '}                 | ${false}
      ${'>=1.2.3'}             | ${false}
      ${'>= foo'}              | ${false}
      ${'= 1.2.3 < 2'}         | ${false}
      ${'< 1 < 2'}             | ${false}
      ${'< 1.2.3 >= 1.0'}      | ${false}
      ${'~> 1.2.3 ~> 2'}       | ${false}
      ${'>= 1.2 < 2 < 3'}      | ${false}
      ${'1.2.3 2.0.0'}         | ${false}
      ${'>= 1 2alpha'}         | ${false}
      ${'!!1.2.3'}             | ${false}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      expect(paket.isValid(input)).toBe(expected);
    });
  });

  describe('isVersion()', () => {
    it.each`
      input               | expected
      ${'1'}              | ${true}
      ${'1.2'}            | ${true}
      ${'1.2.3'}          | ${true}
      ${'1.2.3.4'}        | ${true}
      ${'1.2.3-beta.1'}   | ${true}
      ${'1.2.3+metadata'} | ${true}
      ${'= 1.2.3'}        | ${false}
      ${'~> 1.2'}         | ${false}
      ${'foo'}            | ${false}
      ${''}               | ${false}
      ${null}             | ${false}
      ${undefined}        | ${false}
    `('isVersion("$input") === $expected', ({ input, expected }) => {
      expect(paket.isVersion(input)).toBe(expected);
    });
  });

  describe('isSingleVersion()', () => {
    it.each`
      input            | expected
      ${'1.2.3'}       | ${true}
      ${'= 1.2.3'}     | ${true}
      ${'== 1.2.3'}    | ${true}
      ${'!1.2.3'}      | ${true}
      ${'>= 1.2.3'}    | ${false}
      ${'~> 1'}        | ${false}
      ${'>= 1 < 2'}    | ${false}
      ${'1.2.3 alpha'} | ${false}
      ${'foo'}         | ${false}
    `('isSingleVersion("$input") === $expected', ({ input, expected }) => {
      expect(paket.isSingleVersion(input)).toBe(expected);
    });
  });

  describe('isStable()', () => {
    it.each`
      input               | expected
      ${'1.2.3'}          | ${true}
      ${'1.0.0+metadata'} | ${true}
      ${'1.2.3-beta'}     | ${false}
      ${'= 1.2.3'}        | ${true}
      ${'== 1.2.3'}       | ${true}
      ${'= 1.2.3-rc.1'}   | ${false}
      ${'>= 1.2'}         | ${false}
      ${'foo'}            | ${false}
    `('isStable("$input") === $expected', ({ input, expected }) => {
      expect(paket.isStable(input)).toBe(expected);
    });
  });

  describe('isCompatible()', () => {
    it.each`
      input       | expected
      ${'1.2.3'}  | ${true}
      ${'~> 1.2'} | ${false}
    `('isCompatible("$input") === $expected', ({ input, expected }) => {
      expect(paket.isCompatible(input)).toBe(expected);
    });
  });

  describe('getMajor(), getMinor(), getPatch()', () => {
    it.each`
      input      | major   | minor   | patch
      ${'1.2.3'} | ${1}    | ${2}    | ${3}
      ${'5.4'}   | ${5}    | ${4}    | ${null}
      ${'1'}     | ${1}    | ${null} | ${null}
      ${'foo'}   | ${null} | ${null} | ${null}
    `(
      'getMajor, getMinor, getPatch for "$input"',
      ({ input, major, minor, patch }) => {
        expect(paket.getMajor(input)).toBe(major);
        expect(paket.getMinor(input)).toBe(minor);
        expect(paket.getPatch(input)).toBe(patch);
      },
    );
  });

  describe('equals()', () => {
    it.each`
      left                | right                 | expected
      ${'1.2.3'}          | ${'1.2.3'}            | ${true}
      ${'1.2'}            | ${'1.2.0'}            | ${true}
      ${'1.2.3.0'}        | ${'1.2.3'}            | ${true}
      ${'1'}              | ${'1.0.0'}            | ${true}
      ${'1.2.3+m1'}       | ${'1.2.3+m2'}         | ${true}
      ${'1.2.3'}          | ${'1.2.4'}            | ${false}
      ${'1.0-prerelease'} | ${'1.0.0-prerelease'} | ${true}
      ${'foo'}            | ${'1.2.3'}            | ${false}
      ${'1.2.3'}          | ${'foo'}              | ${false}
    `(
      'equals("$left", "$right") === $expected',
      ({ left, right, expected }) => {
        expect(paket.equals(left, right)).toBe(expected);
      },
    );
  });

  describe('isGreaterThan()', () => {
    it.each`
      left                  | right                 | expected
      ${'1.2.4'}            | ${'1.2.3'}            | ${true}
      ${'1.2.3'}            | ${'1.2.3-beta'}       | ${true}
      ${'1.2.3'}            | ${'1.2.3'}            | ${false}
      ${'1.0.0-alpha.1'}    | ${'1.0.0-alpha'}      | ${true}
      ${'1.0.0-alpha.beta'} | ${'1.0.0-alpha.1'}    | ${true}
      ${'1.0.0-beta'}       | ${'1.0.0-alpha.beta'} | ${true}
      ${'1.0.0-beta.2'}     | ${'1.0.0-beta'}       | ${true}
      ${'1.0.0-beta.11'}    | ${'1.0.0-beta.2'}     | ${true}
      ${'1.0.0-rc.1'}       | ${'1.0.0-beta.11'}    | ${true}
      ${'1.0.0'}            | ${'1.0.0-rc.1'}       | ${true}
      ${'1.0.0.2420'}       | ${'1.0'}              | ${true}
      ${'1.0.0-alpha'}      | ${'1.0.0-prerelease'} | ${true}
      ${'1.0.0-prerelease'} | ${'1.0.0-alpha'}      | ${false}
      ${'1.0.1-alpha'}      | ${'1.0.0-prerelease'} | ${true}
      ${'foo'}              | ${'1.2.3'}            | ${false}
    `(
      'isGreaterThan("$left", "$right") === $expected',
      ({ left, right, expected }) => {
        expect(paket.isGreaterThan(left, right)).toBe(expected);
      },
    );
  });

  describe('sortVersions()', () => {
    it.each`
      left       | right      | expected
      ${'1.2.3'} | ${'1.2.4'} | ${-1}
      ${'1.2.4'} | ${'1.2.3'} | ${1}
      ${'1.2.3'} | ${'1.2.3'} | ${0}
      ${'foo'}   | ${'1.2.3'} | ${0}
    `(
      'sortVersions("$left", "$right") === $expected',
      ({ left, right, expected }) => {
        expect(paket.sortVersions(left, right)).toBe(expected);
      },
    );
  });

  describe('matches()', () => {
    it.each`
      version                 | range                                        | expected
      ${'1.2.3'}              | ${'1.2.3'}                                   | ${true}
      ${'1.2.3.0'}            | ${'1.2.3'}                                   | ${true}
      ${'1.2.4'}              | ${'1.2.3'}                                   | ${false}
      ${'1.2.3'}              | ${'= 1.2.3'}                                 | ${true}
      ${'1.2.3'}              | ${'== 1.2.3'}                                | ${true}
      ${'1.2.3-alpha1'}       | ${'== 1.2.3 alpha'}                          | ${false}
      ${'1.2.3'}              | ${'>= 1.2.3'}                                | ${true}
      ${'2.0.0'}              | ${'>= 1.2.3'}                                | ${true}
      ${'1.2.2'}              | ${'>= 1.2.3'}                                | ${false}
      ${'2.0.0-beta1'}        | ${'>= 1.2.3'}                                | ${false}
      ${'1.2.4'}              | ${'> 1.2.3'}                                 | ${true}
      ${'1.2.3'}              | ${'> 1.2.3'}                                 | ${false}
      ${'1.3.0-beta'}         | ${'> 1.2.3 prerelease'}                      | ${true}
      ${'1.2.3'}              | ${'<= 1.2.3'}                                | ${true}
      ${'1.2.4'}              | ${'<= 1.2.3'}                                | ${false}
      ${'1.2.3-alpha'}        | ${'<= 1.2.3 alpha'}                          | ${true}
      ${'1.2.2'}              | ${'< 1.2.3'}                                 | ${true}
      ${'1.2.3'}              | ${'< 1.2.3'}                                 | ${false}
      ${'1.2.3-alpha'}        | ${'< 1.2.3 prerelease'}                      | ${false}
      ${'1.2.2-alpha'}        | ${'< 1.2.3 prerelease'}                      | ${true}
      ${'1.2.3'}              | ${'~> 1.2.3'}                                | ${true}
      ${'1.2.9'}              | ${'~> 1.2.3'}                                | ${true}
      ${'1.3.0'}              | ${'~> 1.2.3'}                                | ${false}
      ${'1.2.3'}              | ${'~> 1.2'}                                  | ${true}
      ${'1.9.9'}              | ${'~> 1.2'}                                  | ${true}
      ${'2.0.0'}              | ${'~> 1.2'}                                  | ${false}
      ${'0.5.0'}              | ${'~> 0'}                                    | ${true}
      ${'1.0.0'}              | ${'~> 0'}                                    | ${false}
      ${'1.2.3.7'}            | ${'~> 1.2.3.4'}                              | ${true}
      ${'1.2.4'}              | ${'~> 1.2.3.4'}                              | ${false}
      ${'1.2.3-alpha002'}     | ${'~> 1.2.3-alpha001'}                       | ${true}
      ${'1.2.9'}              | ${'~> 1.2.3-alpha001'}                       | ${true}
      ${'1.3.0'}              | ${'~> 1.2.3-alpha001'}                       | ${false}
      ${'1.2.4-beta1'}        | ${'~> 1.2.3-alpha001'}                       | ${false}
      ${'1.2.4'}              | ${'>= 1.2.3 < 1.5'}                          | ${true}
      ${'1.5.0'}              | ${'>= 1.2.3 < 1.5'}                          | ${false}
      ${'1.5.0'}              | ${'>= 1.2.3 <= 1.5'}                         | ${true}
      ${'1.2.3'}              | ${'> 1.2.3 < 1.5'}                           | ${false}
      ${'1.5.0'}              | ${'> 1.2.3 <= 1.5'}                          | ${true}
      ${'1.2.5'}              | ${'~> 1.2 >= 1.2.3'}                         | ${true}
      ${'1.2.2'}              | ${'~> 1.2 >= 1.2.3'}                         | ${false}
      ${'1.9.9'}              | ${'~> 1.2 >= 1.2.3'}                         | ${true}
      ${'2.0.0'}              | ${'~> 1.2 >= 1.2.3'}                         | ${false}
      ${'1.2.3'}              | ${'~> 1.2 > 1.2.3'}                          | ${false}
      ${'1.2.4'}              | ${'~> 1.2 > 1.2.3'}                          | ${true}
      ${'1.2.5'}              | ${'~> 1.2 <= 1.4'}                           | ${true}
      ${'1.4.0'}              | ${'~> 1.2 <= 1.4'}                           | ${true}
      ${'1.4.1'}              | ${'~> 1.2 <= 1.4'}                           | ${false}
      ${'1.3.9'}              | ${'~> 1.2 < 1.4'}                            | ${true}
      ${'1.4.0'}              | ${'~> 1.2 < 1.4'}                            | ${false}
      ${'2.0.0'}              | ${'~> 1.2 <= 2.5'}                           | ${true}
      ${'2.0.1'}              | ${'~> 1.2 <= 2.5'}                           | ${false}
      ${'1.2.3-alpha1'}       | ${'= 1.2.3 alpha'}                           | ${true}
      ${'1.2.3-beta1'}        | ${'= 1.2.3 alpha'}                           | ${false}
      ${'1.2.4-alpha1'}       | ${'= 1.2.3 alpha'}                           | ${false}
      ${'1.2.3-alpha2'}       | ${'= 1.2.3-alpha alpha'}                     | ${false}
      ${'2.0.0-beta1'}        | ${'>= 1.2 prerelease'}                       | ${true}
      ${'2.0.0-beta1'}        | ${'>= 1.2 beta'}                             | ${true}
      ${'2.0.0-beta1'}        | ${'>= 1.2 alpha'}                            | ${false}
      ${'2.0.0-beta1'}        | ${'>= 1.2 alpha beta'}                       | ${true}
      ${'2.0.0'}              | ${'>= 1.2 alpha'}                            | ${true}
      ${'2.0.0-beta1'}        | ${'>= 1.2 prerelease alpha'}                 | ${false}
      ${'2.0.0-xyz'}          | ${'>= 1 PreRelease'}                         | ${true}
      ${'1.2.3-alpha'}        | ${'>= 1.2.3-alpha beta'}                     | ${true}
      ${'1.2.3-alpha'}        | ${'<= 1.2.3-alpha beta'}                     | ${true}
      ${'2.0.0-rc1'}          | ${'>= 1.0 < 2.0 prerelease'}                 | ${false}
      ${'1.9.0-rc1'}          | ${'>= 1.0 < 2.0 prerelease'}                 | ${true}
      ${'1.2.3-alpha2'}       | ${'~> 1.2.3 alpha'}                          | ${true}
      ${'1.5.0-rc'}           | ${'>= 1.0.0-rc < 2.0.0-rc'}                  | ${true}
      ${'1.2.5'}              | ${'!~> 1.2'}                                 | ${true}
      ${'1.0.0'}              | ${'!~> 1.2'}                                 | ${false}
      ${'2.0.0-1.alpha'}      | ${'>= 1 alpha'}                              | ${true}
      ${'2.0.0-1.2'}          | ${'>= 1 alpha'}                              | ${false}
      ${'2.0.0-45-alpha'}     | ${'>= 1 alpha'}                              | ${true}
      ${'2.0.0---alpha'}      | ${'>= 1 alpha'}                              | ${true}
      ${'2.0.0-0121'}         | ${'>= 1 alpha'}                              | ${false}
      ${'2.0.0-0121'}         | ${'>= 1 prerelease'}                         | ${true}
      ${'2.0.0-Beta'}         | ${'>= 1 beta'}                               | ${false}
      ${'1.2.3'}              | ${'foo'}                                     | ${false}
      ${'foo'}                | ${'>= 1'}                                    | ${false}
      ${'2.2'}                | ${'= 2.4'}                                   | ${false}
      ${'1.2.3'}              | ${'1.2.3.0'}                                 | ${true}
      ${'1.0.0.3108'}         | ${'1.0.0.3108'}                              | ${true}
      ${'1.2.3-alpha001'}     | ${'1.2.3-alpha001'}                          | ${true}
      ${'1.2.3-alpha001'}     | ${'1.2.3'}                                   | ${false}
      ${'0.0.5-beta'}         | ${'== 0.0.5-beta'}                           | ${true}
      ${'2.0.3'}              | ${'>= 0'}                                    | ${true}
      ${'1.0.0-rc3-23805'}    | ${'>= 0'}                                    | ${false}
      ${'1.0.0-rc3-23805'}    | ${'>= 0 prerelease'}                         | ${true}
      ${'1.1-beta'}           | ${'>= 1.0-beta prerelease'}                  | ${true}
      ${'0.9.0-build06428'}   | ${'>= 0.9.0-build06428'}                     | ${true}
      ${'1.0.0'}              | ${'> 1.2.3'}                                 | ${false}
      ${'1.3.0'}              | ${'< 1.2.3'}                                 | ${false}
      ${'1.2.3-alpha003'}     | ${'>= 1'}                                    | ${false}
      ${'1.2.3-alpha003'}     | ${'>= 1 prerelease'}                         | ${true}
      ${'1.2.3-alpha023'}     | ${'>= 1 alpha'}                              | ${true}
      ${'1.2.3-alpha023'}     | ${'>= 1 alpha rc'}                           | ${true}
      ${'1.2.3-alpha023'}     | ${'>= 1 beta rc'}                            | ${false}
      ${'1.2.3-rec003'}       | ${'>= 1 prerelease'}                         | ${true}
      ${'1.2.3-rc2'}          | ${'>= 1 alpha'}                              | ${false}
      ${'1.2.3-rc2'}          | ${'>= 1 beta rc'}                            | ${true}
      ${'1.2.3-rc2'}          | ${'>= 2 beta rc'}                            | ${false}
      ${'1.2.3-alpha001'}     | ${'>= 1.2.3 prerelease'}                     | ${true}
      ${'1.2.3-alpha001'}     | ${'1.2.3 prerelease'}                        | ${true}
      ${'1.2.3-alpha001'}     | ${'> 1.2.3 prerelease'}                      | ${false}
      ${'1.0.11'}             | ${'>= 1.0 prerelease'}                       | ${true}
      ${'1.0.12-build0025'}   | ${'>= 1.0 prerelease'}                       | ${true}
      ${'0.33.0-beta'}        | ${'0.33.0-beta prerelease'}                  | ${true}
      ${'2.1'}                | ${'> 2.2 < 3.0'}                             | ${false}
      ${'2.2'}                | ${'> 2.2 < 3.0'}                             | ${false}
      ${'2.5'}                | ${'> 2.2 < 3.0'}                             | ${true}
      ${'3.0'}                | ${'> 2.2 < 3.0'}                             | ${false}
      ${'3.2'}                | ${'> 2.2 < 3.0'}                             | ${false}
      ${'2.1'}                | ${'> 2.2 <= 3.0'}                            | ${false}
      ${'2.2'}                | ${'> 2.2 <= 3.0'}                            | ${false}
      ${'2.5'}                | ${'> 2.2 <= 3.0'}                            | ${true}
      ${'3.0'}                | ${'> 2.2 <= 3.0'}                            | ${true}
      ${'3.2'}                | ${'> 2.2 <= 3.0'}                            | ${false}
      ${'2.1'}                | ${'>= 2.2 < 3.0'}                            | ${false}
      ${'2.2'}                | ${'>= 2.2 < 3.0'}                            | ${true}
      ${'2.5'}                | ${'>= 2.2 < 3.0'}                            | ${true}
      ${'3.0'}                | ${'>= 2.2 < 3.0'}                            | ${false}
      ${'3.2'}                | ${'>= 2.2 < 3.0'}                            | ${false}
      ${'2.1'}                | ${'>= 2.2 <= 3.0'}                           | ${false}
      ${'2.2'}                | ${'>= 2.2 <= 3.0'}                           | ${true}
      ${'2.5'}                | ${'>= 2.2 <= 3.0'}                           | ${true}
      ${'3.0'}                | ${'>= 2.2 <= 3.0'}                           | ${true}
      ${'3.2'}                | ${'>= 2.2 <= 3.0'}                           | ${false}
      ${'1.0.0.2420'}         | ${'~> 1.0'}                                  | ${true}
      ${'1.0.0-alpha002'}     | ${'~> 1.0 alpha'}                            | ${true}
      ${'1.0'}                | ${'~> 1.0 alpha'}                            | ${true}
      ${'3.0.0-alpha1'}       | ${'~> 2.0'}                                  | ${false}
      ${'3.0.0-alpha1'}       | ${'~> 2.0 prerelease'}                       | ${false}
      ${'2.0-alpha'}          | ${'~> 2.0 prerelease'}                       | ${true}
      ${'6.0.5-rc1'}          | ${'~> 6.0.0 prerelease'}                     | ${true}
      ${'6.0.5-beta.2'}       | ${'~> 6.0.0-beta.1'}                         | ${true}
      ${'6.0.5-rc1'}          | ${'~> 6.0.0-beta.1'}                         | ${false}
      ${'2.0.0-alpha1'}       | ${'>= 2.0.0-prerelease <= 2.0.0 prerelease'} | ${true}
      ${'2.0.0-alpha'}        | ${'>= 2.0.0-prerelease prerelease'}          | ${true}
      ${'2.0.0-alpha'}        | ${'>= 2.0.0-prerelease'}                     | ${false}
      ${'2.0.0-prerelease.1'} | ${'>= 2.0.0-prerelease'}                     | ${true}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(paket.matches(version, range)).toBe(expected);
      },
    );
  });

  describe('getSatisfyingVersion()', () => {
    it.each`
      versions                                | range                | expected
      ${['1.2.3', '1.2.4', '1.3.0', '2.0.0']} | ${'~> 1.2'}          | ${'1.3.0'}
      ${['1.2.4', '1.2.3', '1.9.0']}          | ${'>= 1'}            | ${'1.9.0'}
      ${['2.0.0-prerelease', '2.0.0-alpha']}  | ${'>= 1 prerelease'} | ${'2.0.0-alpha'}
      ${['foo', '1.2.3']}                     | ${'>= 1'}            | ${'1.2.3'}
      ${['0.5.0']}                            | ${'>= 1'}            | ${null}
      ${['1.2.3']}                            | ${'foo'}             | ${null}
    `(
      'getSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(paket.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('minSatisfyingVersion()', () => {
    it.each`
      versions                                | range                | expected
      ${['1.2.3', '1.2.4', '1.3.0', '2.0.0']} | ${'~> 1.2'}          | ${'1.2.3'}
      ${['1.2.4', '1.2.3', '1.9.0']}          | ${'>= 1'}            | ${'1.2.3'}
      ${['2.0.0-alpha', '2.0.0-prerelease']}  | ${'>= 1 prerelease'} | ${'2.0.0-prerelease'}
      ${['0.5.0']}                            | ${'>= 1'}            | ${null}
    `(
      'minSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(paket.minSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('isLessThanRange()', () => {
    it.each`
      version    | range                | expected
      ${'1.2.2'} | ${'1.2.3'}           | ${true}
      ${'1.2.3'} | ${'1.2.3'}           | ${false}
      ${'1.2.2'} | ${'== 1.2.3'}        | ${true}
      ${'1.2.2'} | ${'>= 1.2.3'}        | ${true}
      ${'1.2.3'} | ${'>= 1.2.3'}        | ${false}
      ${'1.2.3'} | ${'> 1.2.3'}         | ${true}
      ${'1.2.4'} | ${'> 1.2.3'}         | ${false}
      ${'0.1.0'} | ${'< 1.2.3'}         | ${false}
      ${'0.1.0'} | ${'<= 1.2.3'}        | ${false}
      ${'1.2.2'} | ${'~> 1.2.3'}        | ${true}
      ${'1.2.3'} | ${'~> 1.2.3'}        | ${false}
      ${'1.2.2'} | ${'~> 1.2 >= 1.2.3'} | ${true}
      ${'1.2.3'} | ${'~> 1.2 > 1.2.3'}  | ${true}
      ${'1.2.4'} | ${'~> 1.2 > 1.2.3'}  | ${false}
      ${'1.0.0'} | ${'foo'}             | ${false}
      ${'foo'}   | ${'>= 1'}            | ${false}
    `(
      'isLessThanRange("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(paket.isLessThanRange?.(version, range)).toBe(expected);
      },
    );
  });

  describe('getPinnedValue()', () => {
    it('returns the version as-is', () => {
      expect(paket.getPinnedValue?.('1.2.3')).toBe('1.2.3');
    });
  });

  describe('getNewValue()', () => {
    it.each`
      currentValue         | rangeStrategy        | newVersion        | expected
      ${'1.2.3'}           | ${'replace'}         | ${'2.0.1'}        | ${'2.0.1'}
      ${'1.2.3'}           | ${'pin'}             | ${'2.0.1'}        | ${'2.0.1'}
      ${'!1.2.3'}          | ${'replace'}         | ${'2.0.1'}        | ${'!2.0.1'}
      ${'= 1.2.3'}         | ${'replace'}         | ${'2.0.1'}        | ${'= 2.0.1'}
      ${'== 1.2.3'}        | ${'replace'}         | ${'2.0.1'}        | ${'== 2.0.1'}
      ${'@= 1.2.3'}        | ${'replace'}         | ${'2.0.1'}        | ${'@= 2.0.1'}
      ${'= 1.2.3'}         | ${'replace'}         | ${'2.0.0-beta1'}  | ${'= 2.0.0-beta1'}
      ${'>= 1.2.3'}        | ${'replace'}         | ${'2.0.1'}        | ${'>= 1.2.3'}
      ${'>= 1.2.3'}        | ${'replace'}         | ${'1.0.0'}        | ${'>= 1.2.3'}
      ${'>= 1.2'}          | ${'replace'}         | ${'2.0.0-beta1'}  | ${'>= 1.2 beta'}
      ${'>= 1.2 alpha'}    | ${'replace'}         | ${'2.0.0-beta1'}  | ${'>= 1.2 alpha beta'}
      ${'> 1.2'}           | ${'replace'}         | ${'2.0.0-beta1'}  | ${'> 1.2 beta'}
      ${'< 2.0'}           | ${'replace'}         | ${'2.5.0-beta1'}  | ${'< 2.6 beta'}
      ${'<= 2.0'}          | ${'replace'}         | ${'2.0.0-beta1'}  | ${'<= 2.0 beta'}
      ${'~> 1.2.3'}        | ${'replace'}         | ${'1.2.9'}        | ${'~> 1.2.3'}
      ${'~> 1.2.3'}        | ${'auto'}            | ${'1.3.0'}        | ${'~> 1.3.0'}
      ${'~> 1.2'}          | ${'replace'}         | ${'2.0.5'}        | ${'~> 2.0'}
      ${'~> 1'}            | ${'replace'}         | ${'5.0.0'}        | ${'~> 5'}
      ${'~> 1.2.3'}        | ${'replace'}         | ${'2.1'}          | ${'~> 2.1.0'}
      ${'~> 1.2.3.4'}      | ${'replace'}         | ${'1.2.5.1'}      | ${'~> 1.2.5.1'}
      ${'!~> 1.2'}         | ${'replace'}         | ${'2.0.5'}        | ${'!~> 2.0'}
      ${'~> 1.2'}          | ${'replace'}         | ${'2.0.0-alpha1'} | ${'~> 2.0 alpha'}
      ${'~> 1.2'}          | ${'replace'}         | ${'2.1.0-beta1'}  | ${'~> 2.1 beta'}
      ${'~> 1.2'}          | ${'replace'}         | ${'1.3.0-beta1'}  | ${'~> 1.2 beta'}
      ${'>= 1.2.3 < 1.5'}  | ${'replace'}         | ${'1.5.0'}        | ${'>= 1.2.3 < 1.6'}
      ${'>= 1.2.3 < 1.5'}  | ${'replace'}         | ${'2.1.4'}        | ${'>= 1.2.3 < 2.2'}
      ${'!>= 1.0 < 2.0'}   | ${'replace'}         | ${'2.1.4'}        | ${'!>= 1.0 < 2.2'}
      ${'>= 1.2.3 <= 1.5'} | ${'replace'}         | ${'2.1.4'}        | ${'>= 1.2.3 <= 2.1.4'}
      ${'> 1.0 <= 1.5'}    | ${'replace'}         | ${'2.0.0'}        | ${'> 1.0 <= 2.0.0'}
      ${'> 1.0 <= 1.5'}    | ${'replace'}         | ${'1.2.0-beta1'}  | ${'> 1.0 <= 1.5 beta'}
      ${'>= 1.0 < 2.0'}    | ${'replace'}         | ${'1.5.0-beta1'}  | ${'>= 1.0 < 2.0 beta'}
      ${'>= 1.0 < 2.0'}    | ${'replace'}         | ${'2.0.0-rc1'}    | ${'>= 1.0 < 2.1 rc'}
      ${'>= 1.0 < 2.0'}    | ${'replace'}         | ${'2.5.0-0121'}   | ${'>= 1.0 < 2.6 prerelease'}
      ${'~> 1.2 >= 1.2.3'} | ${'replace'}         | ${'2.1.0'}        | ${'~> 2.1'}
      ${'~> 1.2 >= 1.2.3'} | ${'replace'}         | ${'2.1.3'}        | ${'~> 2.1 >= 2.1.3'}
      ${'~> 1.2 > 1.2.3'}  | ${'replace'}         | ${'2.1.3'}        | ${'~> 2.1 >= 2.1.3'}
      ${'~> 1.2 <= 1.4'}   | ${'replace'}         | ${'1.5.0'}        | ${'~> 1.2 <= 1.5.0'}
      ${'~> 1.2 <= 1.4'}   | ${'replace'}         | ${'2.5.0'}        | ${'~> 2.5 <= 2.5.0'}
      ${'~> 1.2 < 1.4'}    | ${'replace'}         | ${'1.5.0'}        | ${'~> 1.2 < 1.6'}
      ${'1.2.3 alpha'}     | ${'replace'}         | ${'2.0.0'}        | ${'2.0.0 alpha'}
      ${'~> 1.2'}          | ${'update-lockfile'} | ${'1.5.0'}        | ${'~> 1.2'}
      ${'~> 1.2'}          | ${'update-lockfile'} | ${'2.1.0'}        | ${'~> 2.1'}
      ${'~> 1.2'}          | ${'pin'}             | ${'1.5.0'}        | ${'1.5.0'}
      ${'>= 1.2 < 2'}      | ${'pin'}             | ${'1.5.0'}        | ${'1.5.0'}
      ${'!~> 1.2'}         | ${'pin'}             | ${'1.5.0'}        | ${'!1.5.0'}
      ${'>= 1.0'}          | ${'bump'}            | ${'1.5.0'}        | ${'>= 1.5.0'}
      ${'>= 1.0'}          | ${'bump'}            | ${'1.0'}          | ${'>= 1.0'}
      ${'>= 1.0'}          | ${'bump'}            | ${'2.0.0-beta1'}  | ${'>= 2.0.0-beta1'}
      ${'> 1.0'}           | ${'bump'}            | ${'1.5.0'}        | ${'>= 1.5.0'}
      ${'> 1.0'}           | ${'bump'}            | ${'1.0.0'}        | ${'> 1.0'}
      ${'= 1.2.3'}         | ${'bump'}            | ${'2.0.0'}        | ${'= 2.0.0'}
      ${'<= 2.0'}          | ${'bump'}            | ${'2.5.0'}        | ${'<= 2.5.0'}
      ${'<= 3.0'}          | ${'bump'}            | ${'2.0.0-beta1'}  | ${'<= 3.0 beta'}
      ${'>= 1.0 < 2.0'}    | ${'bump'}            | ${'1.5.0'}        | ${'>= 1.5.0 < 2.0'}
      ${'>= 1.0 < 2.0'}    | ${'bump'}            | ${'2.5.0'}        | ${'>= 2.5.0 < 2.6'}
      ${'~> 1.2'}          | ${'bump'}            | ${'1.2.5'}        | ${'~> 1.2 >= 1.2.5'}
      ${'~> 1.2'}          | ${'bump'}            | ${'1.3.0'}        | ${'~> 1.3'}
      ${'~> 1.2'}          | ${'bump'}            | ${'2.1.3'}        | ${'~> 2.1 >= 2.1.3'}
      ${'~> 1.2 >= 1.2.3'} | ${'bump'}            | ${'1.2.5'}        | ${'~> 1.2 >= 1.2.5'}
      ${'~> 1.2 >= 1.2.3'} | ${'bump'}            | ${'2.1.0'}        | ${'~> 2.1'}
      ${'~> 1.2 < 1.9'}    | ${'bump'}            | ${'1.5.3'}        | ${'~> 1.5 < 1.9'}
      ${'~> 1.2 < 1.9'}    | ${'bump'}            | ${'1.2.4'}        | ${'~> 1.2 < 1.9'}
      ${'~> 1.2 < 1.9'}    | ${'bump'}            | ${'2.5.0'}        | ${'~> 2.5 < 2.6'}
      ${'>= 1.0 < 2.0'}    | ${'widen'}           | ${'2.1.0'}        | ${'>= 1.0 < 2.2'}
      ${'>= 1.0 <= 2.0'}   | ${'widen'}           | ${'2.1.0'}        | ${'>= 1.0 <= 2.1.0'}
      ${'>= 1.0 < 2.0'}    | ${'widen'}           | ${'1.5.0'}        | ${'>= 1.0 < 2.0'}
      ${'< 2.0'}           | ${'widen'}           | ${'2.1.0'}        | ${'< 2.2'}
      ${'= 1.2.3'}         | ${'widen'}           | ${'2.0.0'}        | ${'= 2.0.0'}
      ${'~> 1.2'}          | ${'widen'}           | ${'2.1.0'}        | ${'>= 1.2 < 3'}
      ${'~> 1.2'}          | ${'widen'}           | ${'1.1.0'}        | ${'~> 1.2'}
      ${'~> 1.2.3'}        | ${'widen'}           | ${'1.4.1'}        | ${'>= 1.2.3 < 1.5'}
      ${'~> 1.2 >= 1.2.3'} | ${'widen'}           | ${'2.1.0'}        | ${'>= 1.2.3 < 3'}
      ${'~> 1.2 > 1.2.3'}  | ${'widen'}           | ${'2.1.0'}        | ${'> 1.2.3 < 3'}
      ${'~> 1.2 <= 1.4'}   | ${'widen'}           | ${'2.5.0'}        | ${'>= 1.2 <= 2.5.0'}
      ${'~> 1.2 < 1.4'}    | ${'widen'}           | ${'1.4.5'}        | ${'>= 1.2 < 1.5'}
      ${'~> 1.2'}          | ${'widen'}           | ${'1.3.0-beta1'}  | ${'~> 1.2 beta'}
      ${'foo'}             | ${'replace'}         | ${'1.2.3'}        | ${null}
      ${'>= 1.2.3'}        | ${'replace'}         | ${'foo'}          | ${null}
    `(
      'getNewValue("$currentValue", "$rangeStrategy", "$newVersion") === $expected',
      ({ currentValue, rangeStrategy, newVersion, expected }) => {
        expect(
          paket.getNewValue({ currentValue, rangeStrategy, newVersion }),
        ).toBe(expected);
      },
    );

    it('returns the current value verbatim when nothing changes', () => {
      expect(
        paket.getNewValue({
          currentValue: '>=   1.0',
          rangeStrategy: 'bump',
          newVersion: '1.0',
        }),
      ).toBe('>=   1.0');
    });
  });
});
