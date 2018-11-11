const semver = require('../../lib/versioning')('semverCargo');

describe('semver.isValid()', () => {
  it('handles comma', () => {
    expect(semver.isValid('>= 1.0.0, <= 2.0.0')).toBeTruthy();
    expect(semver.isValid('>= 1.0.0,<= 2.0.0')).toBeTruthy();
  });
});
