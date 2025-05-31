import { Version } from './version';

// Implements the exact same test set as the definition of
// https://github.com/hashicorp/go-version/blob/main/version_test.go
// except TestNewSemver, TestCore, TestVersionCompare_versionAndSemver,
// TestVersionSegments64, TestJsonMarshal, TestVersionMetadata
// TestJsonUnmarshal, TestVersionEqual_nil
// as that functionality has not been implemented in version.ts

describe('modules/versioning/hashicorp/version', () => {
  // TestNewVersion
  it.each`
    input                                    | expected
    ${''}                                    | ${true}
    ${'1.2.3'}                               | ${false}
    ${'1.0'}                                 | ${false}
    ${'1'}                                   | ${false}
    ${'1.2.beta'}                            | ${true}
    ${'1.21.beta'}                           | ${true}
    ${'foo'}                                 | ${true}
    ${'1.2-5'}                               | ${false}
    ${'1.2-beta.5'}                          | ${false}
    ${'\n1.2'}                               | ${true}
    ${'1.2.0-x.Y.0+metadata'}                | ${false}
    ${'1.2.0-x.Y.0+metadata-width-hyphen'}   | ${false}
    ${'1.2.3-rc1-with-hyphen'}               | ${false}
    ${'1.2.3.4'}                             | ${false}
    ${'1.2.0.4-x.Y.0+metadata'}              | ${false}
    ${'1.2.0.4-x.Y.0+metadata-width-hyphen'} | ${false}
    ${'1.2.0-X-1.2.0+metadata~dist'}         | ${false}
    ${'1.2.3.4-rc1-with-hyphen'}             | ${false}
    ${'1.2.3.4'}                             | ${false}
    ${'v1.2.3'}                              | ${false}
    ${'foo1.2.3'}                            | ${true}
    ${'1.7rc2'}                              | ${false}
    ${'v1.7rc2'}                             | ${false}
    ${'1.0-'}                                | ${false}
  `('new Version("$input") === $expected', ({ input, expected }) => {
    let threw = false;
    try {
      new Version(input);
    } catch (e) {
      expect(e).toBeInstanceOf(Error); // bs check to statisfy eslint
      threw = true;
    }
    expect(threw).toBe(expected);
  });

  // TestVersionCompare
  it.each`
    version1        | version2                         | expected
    ${'1.2.3'}      | ${'1.4.5'}                       | ${-1}
    ${'1.2-beta'}   | ${'1.2-beta'}                    | ${0}
    ${'1.2'}        | ${'1.1.4'}                       | ${1}
    ${'1.2'}        | ${'1.2-beta'}                    | ${1}
    ${'1.2+foo'}    | ${'1.2+beta'}                    | ${0}
    ${'v1.2'}       | ${'v1.2-beta'}                   | ${1}
    ${'v1.2+foo'}   | ${'v1.2+beta'}                   | ${0}
    ${'v1.2.3.4'}   | ${'v1.2.3.4'}                    | ${0}
    ${'v1.2.0.0'}   | ${'v1.2'}                        | ${0}
    ${'v1.2.0.0.1'} | ${'v1.2'}                        | ${1}
    ${'v1.2'}       | ${'v1.2.0.0'}                    | ${0}
    ${'v1.2'}       | ${'v1.2.0.0.1'}                  | ${-1}
    ${'v1.2.0.0'}   | ${'v1.2.0.0.1'}                  | ${-1}
    ${'v1.2.3.0'}   | ${'v1.2.3.4'}                    | ${-1}
    ${'1.7rc2'}     | ${'1.7rc1'}                      | ${1}
    ${'1.7rc2'}     | ${'1.7'}                         | ${-1}
    ${'1.2.0'}      | ${'1.2.0-X-1.2.0+metadata~dist'} | ${1}
  `(
    '"$version1".compare("$version2") === $expected',
    ({ version1, version2, expected }) => {
      const v1 = new Version(version1);
      const v2 = new Version(version2);
      expect(v1.compare(v2)).toBe(expected);
    },
  );

  // TestComparePreReleases
  it.each`
    version1              | version2            | expected
    ${'1.2-beta.2'}       | ${'1.2-beta.2'}     | ${0}
    ${'1.2-beta.1'}       | ${'1.2-beta.2'}     | ${-1}
    ${'1.2-beta.2'}       | ${'1.2-beta.11'}    | ${-1}
    ${'3.2-alpha.1'}      | ${'3.2-alpha'}      | ${1}
    ${'1.2-beta.2'}       | ${'1.2-beta.1'}     | ${1}
    ${'1.2-beta.11'}      | ${'1.2-beta.2'}     | ${1}
    ${'1.2-beta'}         | ${'1.2-beta.3'}     | ${-1}
    ${'1.2-alpha'}        | ${'1.2-beta.3'}     | ${-1}
    ${'1.2-beta'}         | ${'1.2-alpha.3'}    | ${1}
    ${'3.0-alpha.3'}      | ${'3.0-rc.1'}       | ${-1}
    ${'3.0-alpha3'}       | ${'3.0-rc1'}        | ${-1}
    ${'3.0-alpha.1'}      | ${'3.0-alpha.beta'} | ${-1}
    ${'5.4-alpha'}        | ${'5.4-alpha.beta'} | ${1}
    ${'v1.2-beta.2'}      | ${'v1.2-beta.2'}    | ${0}
    ${'v1.2-beta.1'}      | ${'v1.2-beta.2'}    | ${-1}
    ${'v3.2-alpha.1'}     | ${'v3.2-alpha'}     | ${1}
    ${'v3.2-rc.1-1-g123'} | ${'v3.2-rc.2'}      | ${1}
  `(
    '"$version1".compare("$version2") === $expected',
    ({ version1, version2, expected }) => {
      const v1 = new Version(version1);
      const v2 = new Version(version2);
      expect(v1.compare(v2)).toBe(expected);
    },
  );

  // TestVersionMetadata
  it.each`
    version                                 | expected
    ${'1.2.3'}                              | ${''}
    ${'1.2-beta'}                           | ${'beta'}
    ${'1.2.0-x.Y.0'}                        | ${'x.Y.0'}
    ${'1.2.0-7.Y.0'}                        | ${'7.Y.0'}
    ${'1.2.0-x.Y.0+metadata'}               | ${'x.Y.0'}
    ${'1.2.0-metadata-1.2.0+metadata~dist'} | ${'metadata-1.2.0'}
    ${'17.03.0-ce'}                         | ${'ce'}
  `('"$version".prerelease === $expected', ({ version, expected }) => {
    const v = new Version(version);
    expect(v.prerelease).toBe(expected);
  });

  // TestVersionSegments
  it.each`
    version                                 | expected
    ${'1.2.3'}                              | ${[1, 2, 3]}
    ${'1.2-beta'}                           | ${[1, 2, 0]}
    ${'1-x.Y.0'}                            | ${[1, 0, 0]}
    ${'1.2.0-x.Y.0+metadata'}               | ${[1, 2, 0]}
    ${'1.2.0-metadata-1.2.0+metadata~dist'} | ${[1, 2, 0]}
    ${'17.03.0-ce'}                         | ${[17, 3, 0]}
  `('"$version".segments === $expected', ({ version, expected }) => {
    const v = new Version(version);
    expect(v.segments).toEqual(expected);
  });

  // TestVersionString
  it.each`
    version                                 | expected
    ${'1.2.3'}                              | ${'1.2.3'}
    ${'1.2-beta'}                           | ${'1.2.0-beta'}
    ${'1.2.0-x.Y.0'}                        | ${'1.2.0-x.Y.0'}
    ${'1.2.0-x.Y.0+metadata'}               | ${'1.2.0-x.Y.0+metadata'}
    ${'1.2.0-metadata-1.2.0+metadata~dist'} | ${'1.2.0-metadata-1.2.0+metadata~dist'}
    ${'17.03.0-ce'}                         | ${'17.3.0-ce'}
  `('"$version".segments === $expected', ({ version, expected }) => {
    const v = new Version(version);
    expect(v.toString()).toBe(expected);
  });

  // TestEqual
  it.each`
    version1        | version2                         | expected
    ${'1.2.3'}      | ${'1.4.5'}                       | ${false}
    ${'1.2-beta'}   | ${'1.2-beta'}                    | ${true}
    ${'1.2'}        | ${'1.1.4'}                       | ${false}
    ${'1.2'}        | ${'1.2-beta'}                    | ${false}
    ${'1.2+foo'}    | ${'1.2+beta'}                    | ${true}
    ${'v1.2'}       | ${'v1.2-beta'}                   | ${false}
    ${'v1.2+foo'}   | ${'v1.2+beta'}                   | ${true}
    ${'v1.2.3.4'}   | ${'v1.2.3.4'}                    | ${true}
    ${'v1.2.0.0'}   | ${'v1.2'}                        | ${true}
    ${'v1.2.0.0.1'} | ${'v1.2'}                        | ${false}
    ${'v1.2'}       | ${'v1.2.0.0'}                    | ${true}
    ${'v1.2'}       | ${'v1.2.0.0.1'}                  | ${false}
    ${'v1.2.0.0'}   | ${'v1.2.0.0.1'}                  | ${false}
    ${'v1.2.3.0'}   | ${'v1.2.3.4'}                    | ${false}
    ${'1.7rc2'}     | ${'1.7rc1'}                      | ${false}
    ${'1.7rc2'}     | ${'1.7'}                         | ${false}
    ${'1.2.0'}      | ${'1.2.0-X-1.2.0+metadata~dist'} | ${false}
  `(
    '"$version1".isEqual("$version2") === $expected',
    ({ version1, version2, expected }) => {
      const v1 = new Version(version1);
      const v2 = new Version(version2);
      expect(v1.isEqual(v2)).toBe(expected);
    },
  );

  // TestGreaterThan
  it.each`
    version1        | version2                         | expected
    ${'1.2.3'}      | ${'1.4.5'}                       | ${false}
    ${'1.2-beta'}   | ${'1.2-beta'}                    | ${false}
    ${'1.2'}        | ${'1.1.4'}                       | ${true}
    ${'1.2'}        | ${'1.2-beta'}                    | ${true}
    ${'1.2+foo'}    | ${'1.2+beta'}                    | ${false}
    ${'v1.2'}       | ${'v1.2-beta'}                   | ${true}
    ${'v1.2+foo'}   | ${'v1.2+beta'}                   | ${false}
    ${'v1.2.3.4'}   | ${'v1.2.3.4'}                    | ${false}
    ${'v1.2.0.0'}   | ${'v1.2'}                        | ${false}
    ${'v1.2.0.0.1'} | ${'v1.2'}                        | ${true}
    ${'v1.2'}       | ${'v1.2.0.0'}                    | ${false}
    ${'v1.2'}       | ${'v1.2.0.0.1'}                  | ${false}
    ${'v1.2.0.0'}   | ${'v1.2.0.0.1'}                  | ${false}
    ${'v1.2.3.0'}   | ${'v1.2.3.4'}                    | ${false}
    ${'1.7rc2'}     | ${'1.7rc1'}                      | ${true}
    ${'1.7rc2'}     | ${'1.7'}                         | ${false}
    ${'1.2.0'}      | ${'1.2.0-X-1.2.0+metadata~dist'} | ${true}
  `(
    '"$version1".isGreaterThan("$version2") === $expected',
    ({ version1, version2, expected }) => {
      const v1 = new Version(version1);
      const v2 = new Version(version2);
      expect(v1.isGreaterThan(v2)).toBe(expected);
    },
  );

  // TestLessThan
  it.each`
    version1        | version2                         | expected
    ${'1.2.3'}      | ${'1.4.5'}                       | ${true}
    ${'1.2-beta'}   | ${'1.2-beta'}                    | ${false}
    ${'1.2'}        | ${'1.1.4'}                       | ${false}
    ${'1.2'}        | ${'1.2-beta'}                    | ${false}
    ${'1.2+foo'}    | ${'1.2+beta'}                    | ${false}
    ${'v1.2'}       | ${'v1.2-beta'}                   | ${false}
    ${'v1.2+foo'}   | ${'v1.2+beta'}                   | ${false}
    ${'v1.2.3.4'}   | ${'v1.2.3.4'}                    | ${false}
    ${'v1.2.0.0'}   | ${'v1.2'}                        | ${false}
    ${'v1.2.0.0.1'} | ${'v1.2'}                        | ${false}
    ${'v1.2'}       | ${'v1.2.0.0'}                    | ${false}
    ${'v1.2'}       | ${'v1.2.0.0.1'}                  | ${true}
    ${'v1.2.0.0'}   | ${'v1.2.0.0.1'}                  | ${true}
    ${'v1.2.3.0'}   | ${'v1.2.3.4'}                    | ${true}
    ${'1.7rc2'}     | ${'1.7rc1'}                      | ${false}
    ${'1.7rc2'}     | ${'1.7'}                         | ${true}
    ${'1.2.0'}      | ${'1.2.0-X-1.2.0+metadata~dist'} | ${false}
  `(
    '"$version1".isLessThan("$version2") === $expected',
    ({ version1, version2, expected }) => {
      const v1 = new Version(version1);
      const v2 = new Version(version2);
      expect(v1.isLessThan(v2)).toBe(expected);
    },
  );

  // TestGreaterThanOrEqual
  it.each`
    version1        | version2                         | expected
    ${'1.2.3'}      | ${'1.4.5'}                       | ${false}
    ${'1.2-beta'}   | ${'1.2-beta'}                    | ${true}
    ${'1.2'}        | ${'1.1.4'}                       | ${true}
    ${'1.2'}        | ${'1.2-beta'}                    | ${true}
    ${'1.2+foo'}    | ${'1.2+beta'}                    | ${true}
    ${'v1.2'}       | ${'v1.2-beta'}                   | ${true}
    ${'v1.2+foo'}   | ${'v1.2+beta'}                   | ${true}
    ${'v1.2.3.4'}   | ${'v1.2.3.4'}                    | ${true}
    ${'v1.2.0.0'}   | ${'v1.2'}                        | ${true}
    ${'v1.2.0.0.1'} | ${'v1.2'}                        | ${true}
    ${'v1.2'}       | ${'v1.2.0.0'}                    | ${true}
    ${'v1.2'}       | ${'v1.2.0.0.1'}                  | ${false}
    ${'v1.2.0.0'}   | ${'v1.2.0.0.1'}                  | ${false}
    ${'v1.2.3.0'}   | ${'v1.2.3.4'}                    | ${false}
    ${'1.7rc2'}     | ${'1.7rc1'}                      | ${true}
    ${'1.7rc2'}     | ${'1.7'}                         | ${false}
    ${'1.2.0'}      | ${'1.2.0-X-1.2.0+metadata~dist'} | ${true}
  `(
    '"$version1".isGreaterThanOrEqual("$version2") === $expected',
    ({ version1, version2, expected }) => {
      const v1 = new Version(version1);
      const v2 = new Version(version2);
      expect(v1.isGreaterThanOrEqual(v2)).toBe(expected);
    },
  );

  // TestLessThanOrEqual
  it.each`
    version1        | version2                         | expected
    ${'1.2.3'}      | ${'1.4.5'}                       | ${true}
    ${'1.2-beta'}   | ${'1.2-beta'}                    | ${true}
    ${'1.2'}        | ${'1.1.4'}                       | ${false}
    ${'1.2'}        | ${'1.2-beta'}                    | ${false}
    ${'1.2+foo'}    | ${'1.2+beta'}                    | ${true}
    ${'v1.2'}       | ${'v1.2-beta'}                   | ${false}
    ${'v1.2+foo'}   | ${'v1.2+beta'}                   | ${true}
    ${'v1.2.3.4'}   | ${'v1.2.3.4'}                    | ${true}
    ${'v1.2.0.0'}   | ${'v1.2'}                        | ${true}
    ${'v1.2.0.0.1'} | ${'v1.2'}                        | ${false}
    ${'v1.2'}       | ${'v1.2.0.0'}                    | ${true}
    ${'v1.2'}       | ${'v1.2.0.0.1'}                  | ${true}
    ${'v1.2.0.0'}   | ${'v1.2.0.0.1'}                  | ${true}
    ${'v1.2.3.0'}   | ${'v1.2.3.4'}                    | ${true}
    ${'1.7rc2'}     | ${'1.7rc1'}                      | ${false}
    ${'1.7rc2'}     | ${'1.7'}                         | ${true}
    ${'1.2.0'}      | ${'1.2.0-X-1.2.0+metadata~dist'} | ${false}
  `(
    '"$version1".isLessThanOrEqual("$version2") === $expected',
    ({ version1, version2, expected }) => {
      const v1 = new Version(version1);
      const v2 = new Version(version2);
      expect(v1.isLessThanOrEqual(v2)).toBe(expected);
    },
  );
});
