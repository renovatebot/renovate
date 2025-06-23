import { GlasskubeVersioningApi } from '.';

describe('modules/versioning/glasskube/index', () => {
  const versioning = new GlasskubeVersioningApi();

  it.each`
    version         | expected
    ${'v1.2.3'}     | ${true}
    ${'v1.2.3+1'}   | ${true}
    ${'v1.2.3-1'}   | ${false}
    ${'v1.2.3-1+1'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isStable(version)).toBe(expected);
  });

  it.each`
    version         | expected
    ${'alpha'}      | ${false}
    ${'v1'}         | ${false}
    ${'v1.2'}       | ${false}
    ${'v1.2.3'}     | ${true}
    ${'v1.2.3+1'}   | ${true}
    ${'v1.2.3-1'}   | ${true}
    ${'v1.2.3-1+1'} | ${true}
    ${'1.2.3-1+1'}  | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isValid(version)).toBe(expected);
  });

  it.each`
    version       | major | minor | patch
    ${'v1.2.3'}   | ${1}  | ${2}  | ${3}
    ${'v1.2.3+1'} | ${1}  | ${2}  | ${3}
    ${'v1.2.3-1'} | ${1}  | ${2}  | ${3}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(versioning.getMajor(version)).toBe(major);
      expect(versioning.getMinor(version)).toBe(minor);
      expect(versioning.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    versionA        | versionB
    ${'v1.2.3'}     | ${'v1.2.3+1'}
    ${'v1.2.3+1'}   | ${'v1.2.3+2'}
    ${'v1.2.3-1'}   | ${'v1.2.3+1'}
    ${'v1.2.3-1+1'} | ${'v1.2.3+1'}
    ${'v1.2.3-1'}   | ${'v1.2.3-1+1'}
  `('getMajor, getMinor, getPatch for "$version"', ({ versionA, versionB }) => {
    expect(versioning.isGreaterThan(versionB, versionA)).toBeTrue();
  });
});
