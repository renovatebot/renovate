const versionsHelper = require('../../lib/helpers/versions');
const qJson = require('../_fixtures/npm/01.json');

let defaultConfig;

describe('helpers/versions', () => {
  beforeEach(() => {
    defaultConfig = require('../../lib/config/defaults').getConfig();
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
    it('supports minor and major upgrades for tilde ranges', () => {
      const upgradeVersions = [
        {
          newVersion: '0.9.7',
          newVersionMajor: 0,
          upgradeType: 'minor',
          changeLogFromVersion: '0.4.4',
          changeLogToVersion: '0.9.7',
        },
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.4.4',
          changeLogToVersion: '1.4.1',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig).should.eql(upgradeVersions);
    });
    it('returns only one update if grouping', () => {
      defaultConfig.groupName = 'somegroup';
      expect(versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig)).toMatchSnapshot();
    });
    it('returns only one update if automerging any', () => {
      defaultConfig.automerge = 'any';
      expect(versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig)).toMatchSnapshot();
    });
    it('returns both updates if automerging minor', () => {
      defaultConfig.automerge = 'minor';
      expect(versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig)).toMatchSnapshot();
    });
    it('disables major release separation (major)', () => {
      const config = Object.assign({}, defaultConfig, { separateMajorReleases: false });
      const upgradeVersions = [
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.4.4',
          changeLogToVersion: '1.4.1',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '^0.4.0', config).should.eql(upgradeVersions);
    });
    it('disables major release separation (minor)', () => {
      const config = Object.assign({}, defaultConfig, { separateMajorReleases: false });
      const upgradeVersions = [
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.0.0',
          changeLogToVersion: '1.4.1',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '1.0.0', config).should.eql(upgradeVersions);
    });
    it('supports minor and major upgrades for ranged versions', () => {
      const pinVersions = [
        {
          newVersion: '0.9.7',
          newVersionMajor: 0,
          upgradeType: 'minor',
          changeLogFromVersion: '0.4.4',
          changeLogToVersion: '0.9.7',
        },
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.4.4',
          changeLogToVersion: '1.4.1',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '~0.4.0', defaultConfig).should.eql(pinVersions);
    });
    it('ignores pinning for ranges when other upgrade exists', () => {
      const pinVersions = [
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.9.7',
          changeLogToVersion: '1.4.1',
        },
      ];
      expect(versionsHelper.determineUpgrades(qJson, '~0.9.0', defaultConfig)).toEqual(pinVersions);
    });
    it('upgrades minor ranged versions', () => {
      const upgradeVersions = [
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.0.1',
          changeLogToVersion: '1.4.1',
        },
      ];
      expect(versionsHelper.determineUpgrades(qJson, '~1.0.0', defaultConfig)).toEqual(upgradeVersions);
    });
    it('pins minor ranged versions', () => {
      const upgradeVersions = [
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'pin',
        },
      ];
      expect(versionsHelper.determineUpgrades(qJson, '^1.0.0', defaultConfig)).toEqual(upgradeVersions);
    });
    it('ignores minor ranged versions when not pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '^1.0.0', config)).toHaveLength(0);
    });
    it('upgrades tilde ranges', () => {
      const upgradeVersions = [
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.3.0',
          changeLogToVersion: '1.4.1',
        },
      ];
      expect(versionsHelper.determineUpgrades(qJson, '~1.3.0', defaultConfig)).toEqual(upgradeVersions);
    });
    it('upgrades .x minor ranges', () => {
      const upgradeVersions = [
        {
          newVersion: '1.4.1',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.3.0',
          changeLogToVersion: '1.4.1',
        },
      ];
      expect(versionsHelper.determineUpgrades(qJson, '1.3.x', defaultConfig)).toEqual(upgradeVersions);
    });
    it('upgrades tilde ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '~1.4.0',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.3.0',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '~1.3.0', config)).toEqual(upgradeVersions);
    });
    it('upgrades .x major ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '1.x',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.9.7',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '0.x', config)).toEqual(upgradeVersions);
    });
    it('upgrades .x minor ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '1.4.x',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.3.0',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '1.3.x', config)).toEqual(upgradeVersions);
    });
    it('upgrades shorthand major ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '1',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.9.7',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '0', config)).toEqual(upgradeVersions);
    });
    it('upgrades shorthand minor ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '1.4',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.3.0',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '1.3', config)).toEqual(upgradeVersions);
    });
    it('upgrades multiple tilde ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '~0.9.0',
          newVersionMajor: 0,
          upgradeType: 'minor',
          changeLogFromVersion: '0.7.2',
          changeLogToVersion: '0.9.7',
          isRange: true,
        },
        {
          newVersion: '~1.4.0',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.7.2',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '~0.7.0', config)).toEqual(upgradeVersions);
    });
    it('upgrades multiple caret ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '^0.9.0',
          newVersionMajor: 0,
          upgradeType: 'minor',
          changeLogFromVersion: '0.7.2',
          changeLogToVersion: '0.9.7',
          isRange: true,
        },
        {
          newVersion: '^1.0.0',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.7.2',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '^0.7.0', config)).toEqual(upgradeVersions);
    });
    it('ignores complex ranges when not pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '^0.7.0 || ^0.8.0', config)).toHaveLength(0);
    });
    it('returns nothing for greater than ranges', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '>= 0.7.0', config)).toHaveLength(0);
    });
    it('upgrades less than equal ranges without pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '<= 0.9.7',
          newVersionMajor: 0,
          upgradeType: 'minor',
          changeLogFromVersion: '0.7.2',
          changeLogToVersion: '0.9.7',
          isRange: true,
        },
        {
          newVersion: '<= 1.4.1',
          newVersionMajor: 1,
          upgradeType: 'major',
          changeLogFromVersion: '0.7.2',
          changeLogToVersion: '1.4.1',
          isRange: true,
        },
      ];
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '<= 0.7.2', config)).toEqual(upgradeVersions);
    });
    it('rejects less than ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(versionsHelper.determineUpgrades(qJson, '< 0.7.2', config)).toEqual([]);
    });
    it('supports > latest versions if configured', () => {
      const config = Object.assign({}, defaultConfig);
      config.respectLatest = false;
      const upgradeVersions = [
        {
          newVersion: '2.0.1',
          newVersionMajor: 2,
          upgradeType: 'major',
          changeLogFromVersion: '1.4.1',
          changeLogToVersion: '2.0.1',
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
          newVersion: '2.0.3',
          newVersionMajor: 2,
          upgradeType: 'major',
          changeLogFromVersion: '1.4.1',
          changeLogToVersion: '2.0.3',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '1.4.1', config).should.eql(upgradeVersions);
    });
    it('supports future versions if already future', () => {
      const upgradeVersions = [
        {
          newVersion: '2.0.3',
          newVersionMajor: 2,
          upgradeType: 'pin',
        },
      ];
      versionsHelper.determineUpgrades(qJson, '^2.0.0', defaultConfig).should.eql(upgradeVersions);
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
          newVersion: '1.1.0-beta',
          newVersionMajor: 1,
          upgradeType: 'minor',
          changeLogFromVersion: '1.0.0-beta',
          changeLogToVersion: '1.1.0-beta',
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
});
