const versioning = require('../../lib/versioning');

describe('versioning(versionScheme)', () => {
  it('should fallback to semver', () => {
    expect(versioning(undefined)).toBe(versioning('semver'));
    expect(versioning('unknown')).toBe(versioning('semver'));
  });

  it('should return the same interface', () => {
    const semverApi = Object.keys(versioning('semver'));
    const pep440Api = Object.keys(versioning('pep440')).concat(
      'isLessThanRange'
    );
    expect(pep440Api.sort()).toEqual(semverApi.sort());
  });
});
