const semver = require('../../lib/util/semver');

describe('.isValidVersion(input)', () => {
  it('should support simple semver', () => {
    semver.isValidVersion('1.2.3').should.eql(true);
  });
  it('should support semver with dash', () => {
    semver.isValidVersion('1.2.3-foo').should.eql(true);
  });
  it('should reject semver without dash', () => {
    semver.isValidVersion('1.2.3foo').should.eql(false);
  });
  it('should support ranges', () => {
    semver.isValidVersion('~1.2.3').should.eql(true);
    semver.isValidVersion('^1.2.3').should.eql(true);
    semver.isValidVersion('>1.2.3').should.eql(true);
  });
  it('should reject github repositories', () => {
    semver.isValidVersion('renovateapp/renovate').should.eql(false);
    semver.isValidVersion('renovateapp/renovate#master').should.eql(false);
    semver
      .isValidVersion('https://github.com/renovateapp/renovate.git')
      .should.eql(false);
  });
});
