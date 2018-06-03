const nock = require('nock');
const lookup = require('../../../../../lib/workers/repository/process/lookup');
const qJson = require('../../../../_fixtures/npm/01.json');
const helmetJson = require('../../../../_fixtures/npm/02.json');
const coffeelintJson = require('../../../../_fixtures/npm/coffeelint.json');
const webpackJson = require('../../../../_fixtures/npm/webpack.json');
const nextJson = require('../../../../_fixtures/npm/next.json');
const vueJson = require('../../../../_fixtures/npm/vue.json');
const typescriptJson = require('../../../../_fixtures/npm/typescript.json');

qJson.latestVersion = '1.4.1';

let config;

describe('manager/npm/lookup', () => {
  beforeEach(() => {
    config = { ...require('../../../../../lib/config/defaults').getConfig() };
    config.manager = 'npm';
    config.rangeStrategy = 'replace';
    jest.resetAllMocks();
  });

  describe('.lookupUpdates()', () => {
    it('returns rollback for pinned version', async () => {
      config.currentVersion = '0.9.99';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('returns rollback for ranged version', async () => {
      config.currentVersion = '^0.9.99';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('supports minor and major upgrades for tilde ranges', async () => {
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('returns only one update if grouping', async () => {
      config.groupName = 'somegroup';
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('returns only one update if automerging', async () => {
      config.automerge = true;
      config.currentVersion = '0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('returns only one update if automerging major', async () => {
      config.major = { automerge: true };
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('returns both updates if automerging minor', async () => {
      config.minor = { automerge: true };
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('enforces allowedVersions', async () => {
      config.currentVersion = '0.4.0';
      config.allowedVersions = '<1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toHaveLength(1);
    });
    it('skips invalid allowedVersions', async () => {
      config.currentVersion = '0.4.0';
      config.allowedVersions = 'less than 1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toHaveLength(2);
    });
    it('returns minor update if separate patches not configured', async () => {
      config.currentVersion = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res.length).toBe(2);
      expect(res[0].type).not.toEqual('patch');
      expect(res[1].type).not.toEqual('patch');
    });
    it('returns patch update if automerging patch', async () => {
      config.patch = {
        automerge: true,
      };
      config.currentVersion = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res[0].type).toEqual('patch');
    });
    it('returns minor update if automerging both patch and minor', async () => {
      config.patch = {
        automerge: true,
      };
      config.minor = {
        automerge: true,
      };
      config.currentVersion = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res[0].type).toEqual('minor');
    });
    it('returns patch update if separateMinorPatch', async () => {
      config.separateMinorPatch = true;
      config.currentVersion = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('returns patch minor and major', async () => {
      config.separateMinorPatch = true;
      config.currentVersion = '0.8.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toHaveLength(3);
      expect(res).toMatchSnapshot();
    });
    it('disables major release separation (major)', async () => {
      config.separateMajorMinor = false;
      config.currentVersion = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('disables major release separation (minor)', async () => {
      config.separateMajorMinor = false;
      config.currentVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('supports minor and major upgrades for ranged versions', async () => {
      config.currentVersion = '~0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('ignores pinning for ranges when other upgrade exists', async () => {
      config.currentVersion = '~0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades minor ranged versions', async () => {
      config.currentVersion = '~1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('widens minor ranged versions if configured', async () => {
      config.currentVersion = '~1.3.0';
      config.rangeStrategy = 'widen';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('replaces minor complex ranged versions if configured', async () => {
      config.currentVersion = '~1.2.0 || ~1.3.0';
      config.rangeStrategy = 'replace';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('widens major ranged versions if configured', async () => {
      config.currentVersion = '^2.0.0';
      config.rangeStrategy = 'widen';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('replaces major complex ranged versions if configured', async () => {
      config.currentVersion = '^1.0.0 || ^2.0.0';
      config.rangeStrategy = 'replace';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('pins minor ranged versions', async () => {
      config.currentVersion = '^1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('uses the locked version for pinning', async () => {
      config.currentVersion = '^1.0.0';
      config.lockedVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('ignores minor ranged versions when not pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '^1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toHaveLength(0);
    });
    it('upgrades tilde ranges', async () => {
      config.rangeStrategy = 'pin';
      config.currentVersion = '~1.3.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades .x minor ranges', async () => {
      config.currentVersion = '1.3.x';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '~1.3.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades .x major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '0.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades .x minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '1.3.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades .x complex minor ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '1.2.x - 1.3.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades shorthand major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades shorthand minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '1.3';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades multiple tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '~0.7.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades multiple caret ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '^0.7.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('supports complex ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '^0.7.0 || ^0.8.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toHaveLength(2);
      expect(res[0]).toMatchSnapshot();
    });
    it('supports complex major ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '^1.0.0 || ^2.0.0';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('supports complex major hyphen ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '1.x - 2.x';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('widens .x OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '1.x || 2.x';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('widens stanndalone major OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '1 || 2';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('supports complex tilde ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '~1.2.0 || ~1.3.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('returns nothing for greater than ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '>= 0.7.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toHaveLength(0);
    });
    it('upgrades less than equal ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '<= 0.7.2';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '< 0.7.2';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades less than major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '< 1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades less than equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '<= 1.3';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades less than equal major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.respectLatest = false;
      config.currentVersion = '<= 1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('upgrades major less than equal ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '<= 1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('<= 1.4.1');
    });
    it('upgrades major less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '< 1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('< 2.0.0');
    });
    it('upgrades major greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '>= 0.5.0 < 1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 < 2.0.0');
    });
    it('upgrades minor greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '>= 0.5.0 <0.8';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 <0.10');
      expect(res[1].newVersion).toEqual('>= 0.5.0 <1.5');
    });
    it('upgrades minor greater than less than equals ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '>= 0.5.0 <= 0.8.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res[0].newVersion).toEqual('>= 0.5.0 <= 0.9.7');
      expect(res[1].newVersion).toEqual('>= 0.5.0 <= 1.4.1');
    });
    it('rejects reverse ordered less than greater than', async () => {
      config.rangeStrategy = 'widen';
      config.currentVersion = '<= 0.8.0 >= 0.5.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('supports > latest versions if configured', async () => {
      config.respectLatest = false;
      config.currentVersion = '1.4.1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('should ignore unstable versions if the current version is stable', async () => {
      config.currentVersion = '2.5.16';
      config.depName = 'vue';
      config.purl = 'pkg:npm/vue';
      nock('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      expect(await lookup.lookupUpdates(config)).toHaveLength(0);
    });
    it('should allow unstable versions if the ignoreUnstable=false', async () => {
      config.currentVersion = '2.5.16';
      config.ignoreUnstable = false;
      config.depName = 'vue';
      config.purl = 'pkg:npm/vue';
      nock('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].newVersion).toEqual('2.5.17-beta.0');
    });
    it('should allow unstable versions if the current version is unstable', async () => {
      config.currentVersion = '2.3.0-beta.1';
      config.depName = 'vue';
      config.purl = 'pkg:npm/vue';
      nock('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].newVersion).toEqual('2.5.17-beta.0');
    });
    it('should treat zero zero tilde ranges as 0.0.x', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '~0.0.34';
      config.depName = 'helmet';
      config.purl = 'pkg:npm/helmet';
      nock('https://registry.npmjs.org')
        .get('/helmet')
        .reply(200, helmetJson);
      expect(await lookup.lookupUpdates(config)).toEqual([]);
    });
    it('should treat zero zero caret ranges as pinned', async () => {
      config.rangeStrategy = 'replace';
      config.currentVersion = '^0.0.34';
      config.depName = 'helmet';
      config.purl = 'pkg:npm/helmet';
      nock('https://registry.npmjs.org')
        .get('/helmet')
        .reply(200, helmetJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('should downgrade from missing versions', async () => {
      config.currentVersion = '1.16.1';
      config.depName = 'coffeelint';
      config.purl = 'pkg:npm/coffeelint';
      nock('https://registry.npmjs.org')
        .get('/coffeelint')
        .reply(200, coffeelintJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
    });
    it('should upgrade to only one major', async () => {
      config.currentVersion = '1.0.0';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toHaveLength(2);
    });
    it('should upgrade to two majors', async () => {
      config.currentVersion = '1.0.0';
      config.separateMultipleMajor = true;
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toHaveLength(3);
    });
    it('does not jump  major unstable', async () => {
      config.currentVersion = '^4.4.0-canary.3';
      config.rangeStrategy = 'replace';
      config.depName = 'next';
      nock('https://registry.npmjs.org')
        .get('/next')
        .reply(200, nextJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toHaveLength(0);
    });
    it('handles prerelease jumps', async () => {
      config.currentVersion = '^2.9.0-rc';
      config.rangeStrategy = 'replace';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('supports in-range caret updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '^1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('supports in-range tilde updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '~1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('supports in-range gte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '>=1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('rejects in-range unsupported operator', async () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '>1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('rejects non-fully specified in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '1.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('rejects complex range in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentVersion = '^0.9.0 || ^1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('replaces non-range in-range updates', async () => {
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      config.packageFile = 'package.json';
      config.rangeStrategy = 'bump';
      config.currentVersion = '1.0.0';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('handles github 404', async () => {
      config.depName = 'foo';
      config.purl = 'pkg:github/some/repo';
      config.packageFile = 'package.json';
      config.currentVersion = '1.0.0';
      nock('https://api.github.com')
        .get('/repos/some/repo/git/refs/tags?per_page=100')
        .reply(404);
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('handles unknown purl', async () => {
      config.depName = 'foo';
      config.purl = 'pkg:typo/some/repo';
      config.packageFile = 'package.json';
      config.currentVersion = '1.0.0';
      expect(await lookup.lookupUpdates(config)).toMatchSnapshot();
    });
    it('handles PEP440', async () => {
      config.manager = 'pip_requirements';
      config.versionScheme = 'pep440';
      config.rangeStrategy = 'pin';
      config.lockedVersion = '0.9.4';
      config.currentVersion = '~=0.9';
      config.depName = 'q';
      // TODO: we are using npm as source, since purl for pypi is not implimented
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
  });
});
