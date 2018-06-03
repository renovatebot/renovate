const versioning = require('../../lib/versioning');

describe('versioning(versionScheme)', () => {
  it('should fallback to semver', () => {
    expect(versioning(undefined)).toBe(versioning('semver'));
    expect(versioning('unknown')).toBe(versioning('semver'));
  });
});
