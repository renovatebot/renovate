const versionsHelper = require('../../lib/helpers/versions');
const qJson = require('../_fixtures/npm/01.json');
const defaultConfig = require('../../lib/config/defaults').getConfig();

describe('helpers/versions', () => {
  describe('.determineRangeUpgrades(dep, currentVersion, defaultConfig)', () => {
    it('return empty if invalid current version', () => {
      versionsHelper.determineRangeUpgrades(qJson, 'invalid', defaultConfig).should.have.length(0);
    });
    it('return empty if null versions', () => {
      const testDep = {
        name: 'q',
      };
      versionsHelper.determineRangeUpgrades(testDep, '^1.0.0', defaultConfig).should.have.length(0);
    });
    it('return empty if empty versions', () => {
      const testDep = {
        name: 'q',
        versions: [],
      };
      versionsHelper.determineRangeUpgrades(testDep, '^1.0.0', defaultConfig).should.have.length(0);
    });
    it('should not upgrade a range that matches the latest release of a package', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      versionsHelper.determineRangeUpgrades(qJson, '^1.4.1', config).should.have.length(0);
    });
    it('supports minor and major upgrades for simple ranged versions', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      const upgradeVersions = [
        {
          upgradeType: 'minor',
          newVersion: '0.9.7',
          newVersionMajor: 0,
          newVersionMinor: 9,
          newVersionRange: '^0.9.7',
          workingVersion: '0.4.4',
        },
        {
          upgradeType: 'major',
          newVersion: '1.4.1',
          newVersionMajor: 1,
          newVersionMinor: 4,
          newVersionRange: '^1.4.1',
          workingVersion: '0.4.4',
        },
      ];
      versionsHelper.determineRangeUpgrades(qJson, '^0.4.0', config).should.eql(upgradeVersions);
    });
    it('supports minor and major upgrades for complex ranged versions', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      const upgradeVersions = [
        {
          upgradeType: 'minor',
          newVersion: '0.9.7',
          newVersionMajor: 0,
          newVersionMinor: 9,
          newVersionRange: '0.4.0 || 0.4.1 || 0.9.7',
          workingVersion: '0.4.1',
        },
        {
          upgradeType: 'major',
          newVersion: '1.4.1',
          newVersionMajor: 1,
          newVersionMinor: 4,
          newVersionRange: '0.4.0 || 0.4.1 || 1.4.1',
          workingVersion: '0.4.1',
        },
      ];
      versionsHelper.determineRangeUpgrades(qJson, '0.4.0 || 0.4.1', config).should.eql(upgradeVersions);
    });
    it('supports > latest versions if configured', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false, respectLatest: false });
      const upgradeVersions = [
        {
          upgradeType: 'major',
          newVersion: '2.0.1',
          newVersionMajor: 2,
          newVersionMinor: 0,
          newVersionRange: '^2.0.1',
          workingVersion: '1.4.1',
        },
      ];
      versionsHelper.determineRangeUpgrades(qJson, '^1.4.1', config).should.eql(upgradeVersions);
    });
    it('supports future versions if configured', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      config.ignoreFuture = false;
      config.respectLatest = false;
      const upgradeVersions = [
        {
          upgradeType: 'major',
          newVersion: '2.0.3',
          newVersionMajor: 2,
          newVersionMinor: 0,
          newVersionRange: '2.0.3',
          workingVersion: '1.4.1',
        },
      ];
      versionsHelper.determineRangeUpgrades(qJson, '1.4.1', config).should.eql(upgradeVersions);
    });
    it('supports future versions if already future', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      const upgradeVersions = [
        {
          upgradeType: 'patch',
          newVersion: '2.0.3',
          newVersionMajor: 2,
          newVersionMinor: 0,
          newVersionRange: '2.0.3',
          workingVersion: '2.0.2',
        },
      ];
      versionsHelper.determineRangeUpgrades(qJson, '2.0.2', config).should.eql(upgradeVersions);
    });
    it('should ignore unstable versions if the current version is stable', () => {
      versionsHelper.determineUpgrades({
        name: 'amazing-package',
        versions: {
          '1.0.0': {},
          '1.1.0-beta': {},
        },
      }, '1.0.0', defaultConfig).should.eql([]);
    });
    it('should allow unstable versions if the current version is unstable', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      const upgradeVersions = [
        {
          upgradeType: 'minor',
          newVersion: '1.1.0-beta',
          newVersionMajor: 1,
          newVersionMinor: 1,
          newVersionRange: '1.1.0-beta',
          workingVersion: '1.0.0-beta',
        },
      ];
      versionsHelper.determineRangeUpgrades({
        name: 'amazing-package',
        versions: {
          '1.0.0-beta': {},
          '1.1.0-beta': {},
        },
      }, '1.0.0-beta', config).should.eql(upgradeVersions);
    });
  });
  describe('.determineUpgrades(dep, currentVersion, defaultConfig)', () => {
    it('return empty if invalid current version', () => {
      versionsHelper.determineUpgrades(qJson, 'invalid', defaultConfig).should.have.length(0);
    });
    it('return empty if null versions', () => {
      const testDep = {
        name: 'q',
      };
      versionsHelper.determineUpgrades(testDep, '1.0.0', defaultConfig).should.have.length(0);
    });
    it('return empty if empty versions', () => {
      const testDep = {
        name: 'q',
        versions: [],
      };
      versionsHelper.determineUpgrades(testDep, '1.0.0', defaultConfig).should.have.length(0);
    });
    it('should pin an updated ranged version', () => {
      const upgradeVersions = [
        {
          upgradeType: 'pin',
          newVersion: '1.4.1',
          newVersionMajor: 1,
          newVersionRange: '1.4.1',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '^1.4.1', defaultConfig).should.eql(upgradeVersions);
    });
    it('supports minor and major upgrades', () => {
      const upgradeVersions = [
        {
          upgradeType: 'minor',
          newVersion: '0.9.7',
          newVersionMajor: 0,
          newVersionMinor: 9,
          newVersionRange: '0.9.7',
          workingVersion: '0.4.0',
        },
        {
          upgradeType: 'major',
          newVersion: '1.4.1',
          newVersionMajor: 1,
          newVersionMinor: 4,
          newVersionRange: '1.4.1',
          workingVersion: '0.4.0',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '0.4.0', defaultConfig).should.eql(upgradeVersions);
    });
    it('supports minor and major upgrades for simple ranged versions, pinning those upgrades', () => {
      const upgradeVersions = [
        {
          upgradeType: 'minor',
          newVersion: '0.9.7',
          newVersionMajor: 0,
          newVersionMinor: 9,
          newVersionRange: '0.9.7',
          workingVersion: '0.4.4',
        },
        {
          upgradeType: 'major',
          newVersion: '1.4.1',
          newVersionMajor: 1,
          newVersionMinor: 4,
          newVersionRange: '1.4.1',
          workingVersion: '0.4.4',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig).should.eql(upgradeVersions);
    });
    it('supports > latest versions if configured', () => {
      const config = Object.assign({}, defaultConfig);
      config.respectLatest = false;
      const upgradeVersions = [
        {
          upgradeType: 'major',
          newVersion: '2.0.1',
          newVersionMajor: 2,
          newVersionMinor: 0,
          newVersionRange: '2.0.1',
          workingVersion: '1.4.1',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '1.4.1', config).should.eql(upgradeVersions);
    });
    it('supports future versions if configured', () => {
      const config = Object.assign({}, defaultConfig);
      config.ignoreFuture = false;
      config.respectLatest = false;
      const upgradeVersions = [
        {
          upgradeType: 'major',
          newVersion: '2.0.3',
          newVersionMajor: 2,
          newVersionMinor: 0,
          newVersionRange: '2.0.3',
          workingVersion: '1.4.1',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '1.4.1', config).should.eql(upgradeVersions);
    });
    it('supports future versions if already future', () => {
      const upgradeVersions = [
        {
          upgradeType: 'patch',
          newVersion: '2.0.3',
          newVersionMajor: 2,
          newVersionMinor: 0,
          newVersionRange: '2.0.3',
          workingVersion: '2.0.2',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '2.0.2', defaultConfig).should.eql(upgradeVersions);
    });
    it('should ignore unstable versions if the current version is stable', () => {
      versionsHelper.determineUpgrades({
        name: 'amazing-package',
        versions: {
          '1.0.0': {},
          '1.1.0-beta': {},
        },
      }, '1.0.0', defaultConfig).should.eql([]);
    });
    it('should allow unstable versions if the current version is unstable', () => {
      const upgradeVersions = [
        {
          upgradeType: 'minor',
          newVersion: '1.1.0-beta',
          newVersionMajor: 1,
          newVersionMinor: 1,
          newVersionRange: '1.1.0-beta',
          workingVersion: '1.0.0-beta',
        },
      ];
      versionsHelper.determineUpgrades({
        name: 'amazing-package',
        versions: {
          '1.0.0-beta': {},
          '1.1.0-beta': {},
        },
      }, '1.0.0-beta', defaultConfig).should.eql(upgradeVersions);
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
  describe('.computeRangedVersion(currentVersion, newVersion)', () => {
    it('should return new version as pinned, if current version is pinned', () => {
      versionsHelper.computeRangedVersion('1.0.0', '2.0.0').should.eql('2.0.0');
    });
    it('should return `^` when single operand and `^` operator is used', () => {
      versionsHelper.computeRangedVersion('^1.0.0', '2.0.0').should.eql('^2.0.0');
    });
    it('should return `~` when single operand and `~` operator is used', () => {
      versionsHelper.computeRangedVersion('~1.0.0', '2.0.0').should.eql('~2.0.0');
    });
    it('complex range should append pinned version to existing range', () => {
      versionsHelper.computeRangedVersion('~1.0.0 || ~2.0.0', '2.2.3')
        .should.eql('~1.0.0 || ~2.0.0 || 2.2.3');
    });
  });
});
