const versioning = require('../../lib/versioning');

describe('versioning.get(versionScheme)', () => {
  it('should fallback to semver', () => {
    expect(versioning.get(undefined)).toBe(versioning.get('semver'));
    expect(versioning.get('unknown')).toBe(versioning.get('semver'));
  });

  it('should return the same interface', () => {
    const semverApi = Object.keys(versioning.get('semver')).filter(
      prop => prop !== 'coerce'
    );
    const pep440Api = Object.keys(versioning.get('pep440')).concat(
      'isLessThanRange'
    );
    expect(pep440Api.sort()).toEqual(semverApi.sort());
  });
});
