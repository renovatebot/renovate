const versioning = require('../../lib/versioning');

describe('versioning(versionScheme)', () => {
  it('should fallback to semver', () => {
    expect(versioning(undefined)).toBe(versioning('semver'));
    expect(versioning('unknown')).toBe(versioning('semver'));
  });

  it('should return the same interface', () => {
    const semver = versioning('semver');
    const pep440 = versioning('pep440');
    expect(Object.keys(pep440)).toEqual(Object.keys(semver));
  });
});
