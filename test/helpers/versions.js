const chai = require('chai');
const versionsHelper = require('../../lib/helpers/versions');

chai.should();

describe('helpers/versions', () => {
  describe('.determineUpgrades(depName, currentVersion, versions)', () => {
    const testVersions = ['0.1.0', '1.0.0', '1.0.1', '1.1.0', '2.0.0-alpha1', '2.0.0', '2.0.1', '3.0.0', '3.1.0'];
    it('return empty if invalid current version', () => {
      versionsHelper.determineUpgrades('foo', 'invalid', ['1.0.0', '1.0.1']).should.have.length(0);
    });
    it('return empty if no versions', () => {
      versionsHelper.determineUpgrades('foo', '1.0.0', null).should.have.length(0);
    });
    it('supports minor and major upgrades, including for ranges', () => {
      const upgradeVersions = [
        {
          newVersion: '1.1.0',
          newVersionMajor: 1,
          upgradeType: 'minor',
          workingVersion: '1.0.1',
        },
        {
          newVersion: '2.0.1',
          newVersionMajor: 2,
          upgradeType: 'major',
          workingVersion: '1.0.1',
        },
        {
          newVersion: '3.1.0',
          newVersionMajor: 3,
          upgradeType: 'major',
          workingVersion: '1.0.1',
        },
      ];
      versionsHelper.determineUpgrades('foo', '1.0.1', testVersions).should.eql(upgradeVersions);
      versionsHelper.determineUpgrades('foo', '~1.0.1', testVersions).should.eql(upgradeVersions);
    });
    it('supports pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '3.1.0',
          newVersionMajor: 3,
          upgradeType: 'pin',
        },
      ];
      versionsHelper.determineUpgrades('foo', '^3.0.0', testVersions).should.eql(upgradeVersions);
    });
  });
  describe('.isRange(input)', () => {
    it('rejects simple semver', () => {
      versionsHelper.isRange('1.2.3').should.eql(false);
    });
    it('accepts tilde', () => {
      versionsHelper.isRange('~1.2.3').should.eql(true);
    });
    it('accepts caret', () => {
      versionsHelper.isRange('^1.2.3').should.eql(true);
    });
  });
  describe('.isValidVersion(input)', () => {
    it('should support simple semver', () => {
      versionsHelper.isValidVersion('1.2.3').should.eql(true);
    });
    it('should support versions with dash', () => {
      versionsHelper.isValidVersion('1.2.3-foo').should.eql(true);
    });
    it('should reject versions without dash', () => {
      versionsHelper.isValidVersion('1.2.3foo').should.eql(false);
    });
    it('should support ranges', () => {
      versionsHelper.isValidVersion('~1.2.3').should.eql(true);
      versionsHelper.isValidVersion('^1.2.3').should.eql(true);
      versionsHelper.isValidVersion('>1.2.3').should.eql(true);
    });
    it('should reject github repositories', () => {
      versionsHelper.isValidVersion('singapore/renovate').should.eql(false);
      versionsHelper.isValidVersion('singapore/renovate#master').should.eql(false);
      versionsHelper.isValidVersion('https://github.com/singapore/renovate.git').should.eql(false);
    });
  });
});
