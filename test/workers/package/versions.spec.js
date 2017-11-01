const versions = require('../../../lib/workers/package/versions');
const qJson = require('../../_fixtures/npm/01.json');
const helmetJson = require('../../_fixtures/npm/02.json');
const coffeelintJson = require('../../_fixtures/npm/coffeelint.json');

let config;

describe('workers/package/versions', () => {
  beforeEach(() => {
    config = require('../../../lib/config/defaults').getConfig();
  });

  describe('.determineUpgrades(npmDep, config)', () => {
    it('return warning if null versions', () => {
      config.currentVersion = '1.0.0';
      const testDep = {
        name: 'q',
      };
      const res = versions.determineUpgrades(testDep, config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
    it('return warning if empty versions', () => {
      const testDep = {
        name: 'q',
        versions: [],
      };
      config.currentVersion = '1.0.0';
      const res = versions.determineUpgrades(testDep, config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
    it('supports minor and major upgrades for tilde ranges', () => {
      config.currentVersion = '^0.4.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('returns only one update if grouping', () => {
      config.groupName = 'somegroup';
      config.currentVersion = '^0.4.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('returns only one update if automerging major', () => {
      config.major = { automerge: true };
      config.currentVersion = '^0.4.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('returns both updates if automerging minor', () => {
      config.minor = { automerge: true };
      config.currentVersion = '^0.4.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('returns minor update if separate patches not configured', () => {
      config.currentVersion = '0.9.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res.length).toBe(2);
      expect(res[0].type).not.toEqual('patch');
      expect(res[1].type).not.toEqual('patch');
    });
    it('returns patch update if automerging patch', () => {
      config.patch = {
        automerge: true,
      };
      config.currentVersion = '0.9.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('returns patch update if separatePatchReleases', () => {
      config.separatePatchReleases = true;
      config.currentVersion = '0.9.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('returns patch minor and major', () => {
      config.separatePatchReleases = true;
      config.currentVersion = '0.8.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toHaveLength(3);
      expect(res).toMatchSnapshot();
    });
    it('disables major release separation (major)', () => {
      config.separateMajorReleases = false;
      config.currentVersion = '^0.4.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('disables major release separation (minor)', () => {
      config.separateMajorReleases = false;
      config.currentVersion = '1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('supports minor and major upgrades for ranged versions', () => {
      config.currentVersion = '~0.4.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('ignores pinning for ranges when other upgrade exists', () => {
      config.currentVersion = '~0.9.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades minor ranged versions', () => {
      config.currentVersion = '~1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('pins minor ranged versions', () => {
      config.currentVersion = '^1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('ignores minor ranged versions when not pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '^1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toHaveLength(0);
    });
    it('upgrades tilde ranges', () => {
      config.currentVersion = '~1.3.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades .x minor ranges', () => {
      config.currentVersion = '1.3.x';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades tilde ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '~1.3.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades .x major ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '0.x';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades .x minor ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '1.3.x';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades shorthand major ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades shorthand minor ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '1.3';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades multiple tilde ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '~0.7.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades multiple caret ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '^0.7.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('ignores complex ranges when not pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '^0.7.0 || ^0.8.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
    it('returns nothing for greater than ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '>= 0.7.0';
      expect(versions.determineUpgrades(qJson, config)).toHaveLength(0);
    });
    it('upgrades less than equal ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '<= 0.7.2';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('rejects less than ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '< 0.7.2';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('supports > latest versions if configured', () => {
      config.respectLatest = false;
      config.currentVersion = '1.4.1';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('supports future versions if already future', () => {
      config.currentVersion = '^2.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('should ignore unstable versions if the current version is stable', () => {
      config.currentVersion = '1.0.0';
      versions
        .determineUpgrades(
          {
            name: 'amazing-package',
            versions: {
              '1.0.0': {},
              '1.1.0-beta': {},
            },
          },
          config
        )
        .should.eql([]);
    });
    it('should allow unstable versions if the current version is unstable', () => {
      config.currentVersion = '1.0.0-beta';
      expect(
        versions.determineUpgrades(
          {
            name: 'amazing-package',
            versions: {
              '1.0.0-beta': {},
              '1.1.0-beta': {},
            },
          },
          config
        )
      ).toMatchSnapshot();
    });
    it('should treat zero zero tilde ranges as 0.0.x', () => {
      config.pinVersions = false;
      config.currentVersion = '~0.0.34';
      expect(versions.determineUpgrades(helmetJson, config)).toEqual([]);
    });
    it('should treat zero zero caret ranges as pinned', () => {
      config.pinVersions = false;
      config.currentVersion = '^0.0.34';
      expect(versions.determineUpgrades(helmetJson, config)).toMatchSnapshot();
    });
    it('should downgrade from missing versions', () => {
      config.currentVersion = '1.16.1';
      const res = versions.determineUpgrades(coffeelintJson, config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
  });
  describe('.isRange(input)', () => {
    it('rejects simple semver', () => {
      versions.isRange('1.2.3').should.eql(false);
    });
    it('accepts tilde', () => {
      versions.isRange('~1.2.3').should.eql(true);
    });
    it('accepts caret', () => {
      versions.isRange('^1.2.3').should.eql(true);
    });
  });
  describe('.isValidVersion(input)', () => {
    it('should support simple semver', () => {
      versions.isValidVersion('1.2.3').should.eql(true);
    });
    it('should support versions with dash', () => {
      versions.isValidVersion('1.2.3-foo').should.eql(true);
    });
    it('should reject versions without dash', () => {
      versions.isValidVersion('1.2.3foo').should.eql(false);
    });
    it('should support ranges', () => {
      versions.isValidVersion('~1.2.3').should.eql(true);
      versions.isValidVersion('^1.2.3').should.eql(true);
      versions.isValidVersion('>1.2.3').should.eql(true);
    });
    it('should reject github repositories', () => {
      versions.isValidVersion('singapore/renovate').should.eql(false);
      versions.isValidVersion('singapore/renovate#master').should.eql(false);
      versions
        .isValidVersion('https://github.com/singapore/renovate.git')
        .should.eql(false);
    });
  });
  describe('.isPastLatest(dep, version)', () => {
    it('should return false for less than', () => {
      versions.isPastLatest(qJson, '1.0.0').should.eql(false);
    });
    it('should return false for equal', () => {
      versions.isPastLatest(qJson, '1.4.1').should.eql(false);
    });
    it('should return true for greater than', () => {
      versions.isPastLatest(qJson, '2.0.3').should.eql(true);
    });
  });
});
