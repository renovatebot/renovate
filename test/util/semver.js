const semver = require('../../lib/util/semver');

describe('.isValidSemver(input)', () => {
  it('should support simple semver', () => {
    semver.isValidSemver('1.2.3').should.eql(true);
  });
  it('should support semver with dash', () => {
    semver.isValidSemver('1.2.3-foo').should.eql(true);
  });
  it('should reject semver without dash', () => {
    semver.isValidSemver('1.2.3foo').should.eql(false);
  });
  it('should support ranges', () => {
    semver.isValidSemver('~1.2.3').should.eql(true);
    semver.isValidSemver('^1.2.3').should.eql(true);
    semver.isValidSemver('>1.2.3').should.eql(true);
  });
  it('should reject github repositories', () => {
    semver.isValidSemver('renovateapp/renovate').should.eql(false);
    semver.isValidSemver('renovateapp/renovate#master').should.eql(false);
    semver
      .isValidSemver('https://github.com/renovateapp/renovate.git')
      .should.eql(false);
  });
});
