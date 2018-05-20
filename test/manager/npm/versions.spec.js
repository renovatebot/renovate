const lookup = require('../../../lib/manager/npm/lookup');
const versions = require('../../../lib/manager/npm/versions');
const qJson = require('../../_fixtures/npm/01.json');
const helmetJson = require('../../_fixtures/npm/02.json');
const coffeelintJson = require('../../_fixtures/npm/coffeelint.json');
const webpackJson = require('../../_fixtures/npm/webpack.json');
const nextJson = require('../../_fixtures/npm/next.json');
const typescriptJson = require('../../_fixtures/npm/typescript.json');

qJson.latestVersion = '1.4.1';

let config;

describe('manager/npm/versions', () => {
  beforeEach(() => {
    config = { ...require('../../../lib/config/defaults').getConfig() };
    config.rangeStrategy = 'replace';
  });

  describe('.determineUpgrades(npmDep, config)', () => {
    it('return warning if null versions', () => {
      config.currentVersion = '1.0.0';
      const testDep = {
        name: 'q',
      };
      const res = lookup.lookupUpdates(testDep, config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
    it('return warning if empty versions', () => {
      const testDep = {
        name: 'q',
        versions: [],
      };
      config.currentVersion = '1.0.0';
      const res = lookup.lookupUpdates(testDep, config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
    it('returns rollback if range not found', () => {
      config.currentVersion = '^8.4.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('supports minor and major upgrades for tilde ranges', () => {
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('returns only one update if grouping', () => {
      config.groupName = 'somegroup';
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('returns only one update if automerging major', () => {
      config.major = { automerge: true };
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('returns both updates if automerging minor', () => {
      config.minor = { automerge: true };
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('returns minor update if separate patches not configured', () => {
      config.currentVersion = '0.9.0';
      config.rangeStrategy = 'pin';
      const res = lookup.lookupUpdates(qJson, config);
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
      config.rangeStrategy = 'pin';
      const res = lookup.lookupUpdates(qJson, config);
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
      config.rangeStrategy = 'pin';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].type).toEqual('minor');
    });
    it('returns patch update if separateMinorPatch', () => {
      config.separateMinorPatch = true;
      config.currentVersion = '0.9.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('returns patch minor and major', () => {
      config.separateMinorPatch = true;
      config.currentVersion = '0.8.0';
      config.rangeStrategy = 'pin';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toHaveLength(3);
      expect(res).toMatchSnapshot();
    });
    it('disables major release separation (major)', () => {
      config.separateMajorMinor = false;
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('disables major release separation (minor)', () => {
      config.separateMajorMinor = false;
      config.currentVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('supports minor and major upgrades for ranged versions', () => {
      config.currentVersion = '~0.4.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('ignores pinning for ranges when other upgrade exists', () => {
      config.currentVersion = '~0.9.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades minor ranged versions', () => {
      config.currentVersion = '~1.0.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('widens minor ranged versions if configured', () => {
      config.currentVersion = '~1.3.0';
      config.rangeStrategy = 'widen';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('replaces minor complex ranged versions if configured', () => {
      config.currentVersion = '~1.2.0 || ~1.3.0';
      config.rangeStrategy = 'replace';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('widens major ranged versions if configured', () => {
      config.currentVersion = '^2.0.0';
      config.rangeStrategy = 'widen';
      expect(lookup.lookupUpdates(webpackJson, config)).toMatchSnapshot();
    });
    it('replaces major complex ranged versions if configured', () => {
      config.currentVersion = '^1.0.0 || ^2.0.0';
      config.rangeStrategy = 'replace';
      expect(lookup.lookupUpdates(webpackJson, config)).toMatchSnapshot();
    });
    it('pins minor ranged versions', () => {
      config.currentVersion = '^1.0.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('uses the locked version for pinning', () => {
      config.currentVersion = '^1.0.0';
      config.lockedVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('ignores minor ranged versions when not pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '^1.0.0';
      expect(lookup.lookupUpdates(qJson, config)).toHaveLength(0);
    });
    it('upgrades tilde ranges', () => {
      config.rangeStrategy = 'pin';
      config.currentVersion = '~1.3.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades .x minor ranges', () => {
      config.currentVersion = '1.3.x';
      config.rangeStrategy = 'pin';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades tilde ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '~1.3.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades .x major ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '0.x';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades .x minor ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '1.3.x';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades shorthand major ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades shorthand minor ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '1.3';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades multiple tilde ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '~0.7.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades multiple caret ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '^0.7.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('supports complex ranges', () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '^0.7.0 || ^0.8.0';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toHaveLength(2);
      expect(res[0]).toMatchSnapshot();
    });
    it('supports complex major ranges', () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '^1.0.0 || ^2.0.0';
      const res = lookup.lookupUpdates(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('supports complex major hyphen ranges', () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '1.x - 2.x';
      const res = lookup.lookupUpdates(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('widens .x OR ranges', () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '1.x || 2.x';
      const res = lookup.lookupUpdates(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('widens stanndalone major OR ranges', () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '1 || 2';
      const res = lookup.lookupUpdates(webpackJson, config);
      expect(res).toMatchSnapshot();
    });
    it('supports complex tilde ranges', () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '~1.2.0 || ~1.3.0';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
    });
    it('returns nothing for greater than ranges', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '>= 0.7.0';
      expect(lookup.lookupUpdates(qJson, config)).toHaveLength(0);
    });
    it('upgrades less than equal ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '<= 0.7.2';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades less than ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '< 0.7.2';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('upgrades major less than equal ranges', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '<= 1.0.0';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('<= 1.4.1');
    });
    it('upgrades major less than ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '< 1.0.0';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('< 2.0.0');
    });
    it('upgrades major greater than less than ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '>= 0.5.0 < 1.0.0';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 < 2.0.0');
    });
    it('upgrades minor greater than less than ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '>= 0.5.0 <0.8';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 <0.10');
      expect(res[1].newVersion).toEqual('>= 0.5.0 <1.5');
    });
    it('upgrades minor greater than less than equals ranges without pinning', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '>= 0.5.0 <= 0.8.0';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 <= 0.10.0');
      expect(res[1].newVersion).toEqual('>= 0.5.0 <= 1.5.0');
    });
    it('rejects reverse ordered less than greater than', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '<= 0.8.0 >= 0.5.0';
      const res = lookup.lookupUpdates(qJson, config);
      expect(res).toMatchSnapshot();
    });
    it('supports > latest versions if configured', () => {
      config.respectLatest = false;
      config.currentVersion = '1.4.1';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
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
        lookup.lookupUpdates(
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
      config.rangeStrategy = 'replace';
      config.currentVersion = '~0.0.34';
      expect(lookup.lookupUpdates(helmetJson, config)).toEqual([]);
    });
    it('should treat zero zero caret ranges as pinned', () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '^0.0.34';
      expect(lookup.lookupUpdates(helmetJson, config)).toMatchSnapshot();
    });
    it('should downgrade from missing versions', () => {
      config.currentVersion = '1.16.1';
      const res = lookup.lookupUpdates(coffeelintJson, config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
    it('should upgrade to only one major', () => {
      config.currentVersion = '1.0.0';
      const res = lookup.lookupUpdates(webpackJson, config);
      expect(res).toHaveLength(2);
    });
    it('should upgrade to two majors', () => {
      config.currentVersion = '1.0.0';
      config.separateMultipleMajor = true;
      const res = lookup.lookupUpdates(webpackJson, config);
      expect(res).toHaveLength(3);
    });
    it('does not jump  major unstable', () => {
      config.currentVersion = '^4.4.0-canary.3';
      config.rangeStrategy = 'replace';
      const res = lookup.lookupUpdates(nextJson, config);
      expect(res).toHaveLength(0);
    });
    it('handles prerelease jumps', () => {
      config.currentVersion = '^2.9.0-rc';
      config.rangeStrategy = 'replace';
      const res = lookup.lookupUpdates(typescriptJson, config);
      expect(res).toMatchSnapshot();
    });
    it('supports in-range updates', () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '~1.0.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('rejects in-range unsupported operator', () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '>=1.0.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('rejects non-fully specified in-range updates', () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '1.x';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('rejects complex range in-range updates', () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '^0.9.0 || ^1.0.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
    });
    it('rejects non-range in-range updates', () => {
      config.depName = 'q';
      config.packageFile = 'package.json';
      config.rangeStrategy = 'bump';
      config.currentVersion = '1.0.0';
      expect(lookup.lookupUpdates(qJson, config)).toMatchSnapshot();
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
