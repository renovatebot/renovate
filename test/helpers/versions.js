const chai = require('chai');
const versionsHelper = require('../../lib/helpers/versions');

chai.should();

const qJson = require('../_fixtures/npm/01.json');

describe('helpers/versions', () => {
  describe('.determineUpgrades(dep, currentVersion)', () => {
    it('return empty if invalid current version', () => {
      versionsHelper.determineUpgrades(qJson, 'invalid').should.have.length(0);
    });
    it('return empty if null versions', () => {
      const testDep = {
        name: 'q',
      };
      versionsHelper.determineUpgrades(testDep, '1.0.0').should.have.length(0);
    });
    it('return empty if empty versions', () => {
      const testDep = {
        name: 'q',
        versions: [],
      };
      versionsHelper.determineUpgrades(testDep, '1.0.0', []).should.have.length(0);
    });
    it('supports minor and major upgrades for pinned versions', () => {
      const upgradeVersions = [
        {
          newVersion: '0.9.7',
          newVersionMajor: 0,
          upgradeType: 'minor',
          workingVersion: '0.4.4',
        },
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'major',
          workingVersion: '0.4.4',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '^0.4.0').should.eql(upgradeVersions);
    });
    it('supports minor and major upgrades for ranged versions', () => {
      const pinVersions = [
        {
          newVersion: '0.9.7',
          newVersionMajor: 0,
          upgradeType: 'minor',
          workingVersion: '0.4.4',
        },
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'major',
          workingVersion: '0.4.4',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '~0.4.0').should.eql(pinVersions);
    });
    it('supports future versions', () => {
      const upgradeVersions = [
        {
          newVersion: '2.0.3',
          newVersionMajor: 2,
          upgradeType: 'pin',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '^2.0.0').should.eql(upgradeVersions);
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
  describe('.isPastLatest(dep, version)', () => {
    it('should return false for less than', () => {
      versionsHelper.isPastLatest(qJson, '1.0.0').should.eql(false);
    });
    it('should return false for equal', () => {
      versionsHelper.isPastLatest(qJson, '1.4.1').should.eql(false);
    });
    it('should return true for greater than', () => {
      versionsHelper.isPastLatest(qJson, '2.0.3').should.eql(true);
    });
  });
});
