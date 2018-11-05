const docker = require('../../lib/versioning')('docker');

describe('docker.isValid(input)', () => {
  it('should return null for short version', () => {
    expect(!!docker.isValid('3.7')).toBe(false);
  });
  it('should support semver', () => {
    expect(!!docker.isValid('1.2.3')).toBe(true);
  });
});
