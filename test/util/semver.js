const semver = require('../../lib/util/semver');

describe('.isValidVersionOrRange(input)', () => {
  it('should support simple semver', () => {
    semver.isValidVersionOrRange('1.2.3').should.eql(true);
  });
  it('should support semver with dash', () => {
    semver.isValidVersionOrRange('1.2.3-foo').should.eql(true);
  });
  it('should reject semver without dash', () => {
    semver.isValidVersionOrRange('1.2.3foo').should.eql(false);
  });
  it('should support ranges', () => {
    semver.isValidVersionOrRange('~1.2.3').should.eql(true);
    semver.isValidVersionOrRange('^1.2.3').should.eql(true);
    semver.isValidVersionOrRange('>1.2.3').should.eql(true);
  });
  it('should reject github repositories', () => {
    semver.isValidVersionOrRange('renovateapp/renovate').should.eql(false);
    semver
      .isValidVersionOrRange('renovateapp/renovate#master')
      .should.eql(false);
    semver
      .isValidVersionOrRange('https://github.com/renovateapp/renovate.git')
      .should.eql(false);
  });
});
