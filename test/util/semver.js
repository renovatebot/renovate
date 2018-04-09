const semver = require('../../lib/util/semver');

describe('.isVersionOrRange(input)', () => {
  it('should support simple semver', () => {
    semver.isVersionOrRange('1.2.3').should.eql(true);
  });
  it('should support semver with dash', () => {
    semver.isVersionOrRange('1.2.3-foo').should.eql(true);
  });
  it('should reject semver without dash', () => {
    semver.isVersionOrRange('1.2.3foo').should.eql(false);
  });
  it('should support ranges', () => {
    semver.isVersionOrRange('~1.2.3').should.eql(true);
    semver.isVersionOrRange('^1.2.3').should.eql(true);
    semver.isVersionOrRange('>1.2.3').should.eql(true);
  });
  it('should reject github repositories', () => {
    semver.isVersionOrRange('renovateapp/renovate').should.eql(false);
    semver.isVersionOrRange('renovateapp/renovate#master').should.eql(false);
    semver
      .isVersionOrRange('https://github.com/renovateapp/renovate.git')
      .should.eql(false);
  });
});
