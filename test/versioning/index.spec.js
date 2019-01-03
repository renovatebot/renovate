const versioning = require('../../lib/versioning');

describe('versioning.get(versionScheme)', () => {
  it('should fallback to semver', () => {
    expect(versioning.get(undefined)).toBe(versioning.get('npm'));
    expect(versioning.get('unknown')).toBe(versioning.get('npm'));
  });

  it('should return the same interface', () => {
    const semverApi = Object.keys(versioning.get('npm'));
    const pep440Api = Object.keys(versioning.get('pep440')).concat(
      'isLessThanRange'
    );
    expect(pep440Api.sort()).toEqual(semverApi.sort());
  });
});
