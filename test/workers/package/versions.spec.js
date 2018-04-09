const versions = require('../../../lib/workers/package/versions');
const qJson = require('../../_fixtures/npm/01.json');
const helmetJson = require('../../_fixtures/npm/02.json');
const coffeelintJson = require('../../_fixtures/npm/coffeelint.json');
const webpackJson = require('../../_fixtures/npm/webpack.json');
const nextJson = require('../../_fixtures/npm/next.json');

let config;

describe('workers/package/versions', () => {
  beforeEach(() => {
    config = { ...require('../../../lib/config/defaults').getConfig() };
    config.pinVersions = true;
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
    it('returns warning if range not found', () => {
      config.currentVersion = '^8.4.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
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
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].type).toEqual('patch');
    });
    it('returns minor update if automerging both patch and minor', () => {
      config.patch = {
        automerge: true,
      };
      config.minor = {
        automerge: true,
      };
      config.currentVersion = '0.9.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].type).toEqual('minor');
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
    it('widens minor ranged versions if configured', () => {
      config.pinVersions = false;
      config.currentVersion = '~1.3.0';
      config.versionStrategy = 'widen';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('replaces minor complex ranged versions if configured', () => {
      config.pinVersions = false;
      config.currentVersion = '~1.2.0 || ~1.3.0';
      config.versionStrategy = 'replace';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('widens major ranged versions if configured', () => {
      config.pinVersions = false;
      config.currentVersion = '^2.0.0';
      config.versionStrategy = 'widen';
      expect(versions.determineUpgrades(webpackJson, config)).toMatchSnapshot();
    });
    it('replaces major complex ranged versions if configured', () => {
      config.pinVersions = false;
      config.currentVersion = '^1.0.0 || ^2.0.0';
      config.versionStrategy = 'replace';
      expect(versions.determineUpgrades(webpackJson, config)).toMatchSnapshot();
    });
    it('pins minor ranged versions', () => {
      config.currentVersion = '^1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('uses the locked version for pinning', () => {
      config.currentVersion = '^1.0.0';
      config.lockedVersion = '1.0.0';
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
    it('supports complex ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '^0.7.0 || ^0.8.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toHaveLength(2);
      expect(res[0]).toMatchSnapshot();
    });
    it('supports complex major ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '^1.0.0 || ^2.0.0';
      const res = versions.determineUpgrades(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('supports complex major hyphen ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '1.x - 2.x';
      const res = versions.determineUpgrades(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('widens .x OR ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '1.x || 2.x';
      const res = versions.determineUpgrades(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('widens stanndalone major OR ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '1 || 2';
      const res = versions.determineUpgrades(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('supports complex tilde ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '~1.2.0 || ~1.3.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
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
    it('upgrades less than ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '< 0.7.2';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('upgrades major less than equal ranges', () => {
      config.pinVersions = false;
      config.currentVersion = '<= 1.0.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('<= 2.0.0');
    });
    it('upgrades major less than ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '< 1.0.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('< 2.0.0');
    });
    it('upgrades major greater than less than ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '>= 0.5.0 < 1.0.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 < 2.0.0');
    });
    it('upgrades minor greater than less than ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '>= 0.5.0 <0.8';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 <0.10');
      expect(res[1].newVersion).toEqual('>= 0.5.0 <1.5');
    });
    it('upgrades minor greater than less than equals ranges without pinning', () => {
      config.pinVersions = false;
      config.currentVersion = '>= 0.5.0 <= 0.8.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 <= 0.10.0');
      expect(res[1].newVersion).toEqual('>= 0.5.0 <= 1.5.0');
    });
    it('rejects reverse ordered less than greater than', () => {
      config.pinVersions = false;
      config.currentVersion = '<= 0.8.0 >= 0.5.0';
      const res = versions.determineUpgrades(qJson, config);
      expect(res).toMatchSnapshot();
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
    it('should upgrade to only one major', () => {
      config.currentVersion = '1.0.0';
      const res = versions.determineUpgrades(webpackJson, config);
      expect(res).toHaveLength(2);
    });
    it('should upgrade to two majors', () => {
      config.currentVersion = '1.0.0';
      config.multipleMajorPrs = true;
      const res = versions.determineUpgrades(webpackJson, config);
      expect(res).toHaveLength(3);
    });
    it('does not jump  major unstable', () => {
      config.currentVersion = '^4.4.0-canary.3';
      config.pinVersions = false;
      const res = versions.determineUpgrades(nextJson, config);
      expect(res).toHaveLength(0);
    });
    it('supports in-range updates', () => {
      config.upgradeInRange = true;
      config.currentVersion = '~1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('rejects in-range unsupported operator', () => {
      config.upgradeInRange = true;
      config.pinVersions = false;
      config.currentVersion = '>=1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('rejects non-fully specified in-range updates', () => {
      config.upgradeInRange = true;
      config.pinVersions = false;
      config.currentVersion = '1.x';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('rejects complex range in-range updates', () => {
      config.upgradeInRange = true;
      config.pinVersions = false;
      config.currentVersion = '^0.9.0 || ^1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
    });
    it('rejects non-range in-range updates', () => {
      config.upgradeInRange = true;
      config.pinVersions = false;
      config.currentVersion = '1.0.0';
      expect(versions.determineUpgrades(qJson, config)).toMatchSnapshot();
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
      versions.isValidVersion('renovateapp/renovate').should.eql(false);
      versions.isValidVersion('renovateapp/renovate#master').should.eql(false);
      versions
        .isValidVersion('https://github.com/renovateapp/renovate.git')
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
