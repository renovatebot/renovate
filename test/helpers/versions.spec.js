const versionsHelper = require('../../lib/helpers/versions');
const qJson = require('../_fixtures/npm/01.json');
const helmetJson = require('../_fixtures/npm/02.json');

let defaultConfig;

describe('helpers/versions', () => {
  beforeEach(() => {
    defaultConfig = require('../../lib/config/defaults').getConfig();
  });

  describe('.determineUpgrades(dep, currentVersion, defaultConfig)', () => {
    it('return empty if invalid current version', () => {
      versionsHelper
        .determineUpgrades(qJson, 'invalid', defaultConfig)
        .should.have.length(0);
    });
    it('return empty if null versions', () => {
      const testDep = {
        name: 'q',
      };
      versionsHelper
        .determineUpgrades(testDep, '1.0.0', defaultConfig)
        .should.have.length(0);
    });
    it('return empty if empty versions', () => {
      const testDep = {
        name: 'q',
        versions: [],
      };
      versionsHelper
        .determineUpgrades(testDep, '1.0.0', defaultConfig)
        .should.have.length(0);
    });
    it('supports minor and major upgrades for tilde ranges', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('returns only one update if grouping', () => {
      defaultConfig.groupName = 'somegroup';
      expect(
        versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('returns only one update if automerging any', () => {
      defaultConfig.automerge = 'any';
      expect(
        versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('returns both updates if automerging minor', () => {
      defaultConfig.automerge = 'minor';
      expect(
        versionsHelper.determineUpgrades(qJson, '^0.4.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('disables major release separation (major)', () => {
      const config = Object.assign({}, defaultConfig, {
        separateMajorReleases: false,
      });
      expect(
        versionsHelper.determineUpgrades(qJson, '^0.4.0', config)
      ).toMatchSnapshot();
    });
    it('disables major release separation (minor)', () => {
      const config = Object.assign({}, defaultConfig, {
        separateMajorReleases: false,
      });
      expect(
        versionsHelper.determineUpgrades(qJson, '1.0.0', config)
      ).toMatchSnapshot();
    });
    it('supports minor and major upgrades for ranged versions', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '~0.4.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('ignores pinning for ranges when other upgrade exists', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '~0.9.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('upgrades minor ranged versions', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '~1.0.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('pins minor ranged versions', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '^1.0.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('ignores minor ranged versions when not pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '^1.0.0', config)
      ).toHaveLength(0);
    });
    it('upgrades tilde ranges', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '~1.3.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('upgrades .x minor ranges', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '1.3.x', defaultConfig)
      ).toMatchSnapshot();
    });
    it('upgrades tilde ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '~1.3.0', config)
      ).toMatchSnapshot();
    });
    it('upgrades .x major ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '0.x', config)
      ).toMatchSnapshot();
    });
    it('upgrades .x minor ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '1.3.x', config)
      ).toMatchSnapshot();
    });
    it('upgrades shorthand major ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '0', config)
      ).toMatchSnapshot();
    });
    it('upgrades shorthand minor ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '1.3', config)
      ).toMatchSnapshot();
    });
    it('upgrades multiple tilde ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '~0.7.0', config)
      ).toMatchSnapshot();
    });
    it('upgrades multiple caret ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '^0.7.0', config)
      ).toMatchSnapshot();
    });
    it('ignores complex ranges when not pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '^0.7.0 || ^0.8.0', config)
      ).toHaveLength(0);
    });
    it('returns nothing for greater than ranges', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '>= 0.7.0', config)
      ).toHaveLength(0);
    });
    it('upgrades less than equal ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '<= 0.7.2', config)
      ).toMatchSnapshot();
    });
    it('rejects less than ranges without pinning', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(qJson, '< 0.7.2', config)
      ).toEqual([]);
    });
    it('supports > latest versions if configured', () => {
      const config = Object.assign({}, defaultConfig);
      config.respectLatest = false;
      expect(
        versionsHelper.determineUpgrades(qJson, '1.4.1', config)
      ).toMatchSnapshot();
    });
    it('supports future versions if configured', () => {
      const config = Object.assign({}, defaultConfig);
      config.ignoreFuture = false;
      config.respectLatest = false;
      expect(
        versionsHelper.determineUpgrades(qJson, '1.4.1', config)
      ).toMatchSnapshot();
    });
    it('supports future versions if already future', () => {
      expect(
        versionsHelper.determineUpgrades(qJson, '^2.0.0', defaultConfig)
      ).toMatchSnapshot();
    });
    it('should ignore unstable versions if the current version is stable', () => {
      versionsHelper
        .determineUpgrades(
          {
            name: 'amazing-package',
            versions: {
              '1.0.0': {},
              '1.1.0-beta': {},
            },
          },
          '1.0.0',
          defaultConfig
        )
        .should.eql([]);
    });
    it('should allow unstable versions if the current version is unstable', () => {
      expect(
        versionsHelper.determineUpgrades(
          {
            name: 'amazing-package',
            versions: {
              '1.0.0-beta': {},
              '1.1.0-beta': {},
            },
          },
          '1.0.0-beta',
          defaultConfig
        )
      ).toMatchSnapshot();
    });
    it('should treat zero zero tilde ranges as 0.0.x', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(helmetJson, '~0.0.34', config)
      ).toEqual([]);
    });
    it('should treat zero zero caret ranges as pinned', () => {
      const config = Object.assign({}, defaultConfig, { pinVersions: false });
      expect(
        versionsHelper.determineUpgrades(helmetJson, '^0.0.34', config)
      ).toMatchSnapshot();
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
      versionsHelper
        .isValidVersion('singapore/renovate#master')
        .should.eql(false);
      versionsHelper
        .isValidVersion('https://github.com/singapore/renovate.git')
        .should.eql(false);
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
