const nock = require('nock');
const lookup = require('../../../../../lib/workers/repository/process/lookup');
const qJson = require('../../../../_fixtures/npm/01.json');
const helmetJson = require('../../../../_fixtures/npm/02.json');
const coffeelintJson = require('../../../../_fixtures/npm/coffeelint.json');
const webpackJson = require('../../../../_fixtures/npm/webpack.json');
const nextJson = require('../../../../_fixtures/npm/next.json');
const vueJson = require('../../../../_fixtures/npm/vue.json');
const typescriptJson = require('../../../../_fixtures/npm/typescript.json');
const docker = require('../../../../../lib/datasource/docker');

jest.mock('../../../../../lib/datasource/docker');

qJson.latestVersion = '1.4.1';

let config;

describe('workers/repository/process/lookup', () => {
  beforeEach(() => {
    config = { ...require('../../../../../lib/config/defaults').getConfig() };
    config.manager = 'npm';
    config.versionScheme = 'npm';
    config.rangeStrategy = 'replace';
    global.repoCache = {};
    jest.resetAllMocks();
  });

  describe('.lookupUpdates()', () => {
    it('returns rollback for pinned version', async () => {
      config.currentValue = '0.9.99';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      config.rollbackPrs = true;
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('returns rollback for ranged version', async () => {
      config.currentValue = '^0.9.99';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      config.rollbackPrs = true;
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports minor and major upgrades for tilde ranges', async () => {
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports lock file updates mixed with regular updates', async () => {
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'lockfile-update';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      config.lockedVersion = '0.4.0';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('returns multiple updates if grouping but separateMajorMinor=true', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(2);
    });
    it('returns additional update if grouping but separateMinorPatch=true', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.separateMinorPatch = true;
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(3);
    });
    it('returns one update if grouping and separateMajorMinor=false', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.separateMajorMinor = false;
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
    });
    it('returns only one update if automerging', async () => {
      config.automerge = true;
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
    });
    it('returns only one update if automerging major', async () => {
      config.major = { automerge: true };
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('returns both updates if automerging minor', async () => {
      config.minor = { automerge: true };
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('enforces allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });
    it('falls back to semver syntax allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      config.versionScheme = 'docker'; // this doesn't make sense but works for this test
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });
    it('skips invalid allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = 'less than 1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(2);
    });
    it('returns minor update if separate patches not configured', async () => {
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates.length).toBe(2);
      expect(res.updates[0].updateType).not.toEqual('patch');
      expect(res.updates[1].updateType).not.toEqual('patch');
    });
    it('returns patch update if automerging patch', async () => {
      config.patch = {
        automerge: true,
      };
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].updateType).toEqual('patch');
    });
    it('returns minor update if automerging both patch and minor', async () => {
      config.patch = {
        automerge: true,
      };
      config.minor = {
        automerge: true,
      };
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].updateType).toEqual('minor');
    });
    it('returns patch update if separateMinorPatch', async () => {
      config.separateMinorPatch = true;
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('returns patch minor and major', async () => {
      config.separateMinorPatch = true;
      config.currentValue = '0.8.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(3);
      expect(res.updates).toMatchSnapshot();
    });
    it('disables major release separation (major)', async () => {
      config.separateMajorMinor = false;
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('disables major release separation (minor)', async () => {
      config.separateMajorMinor = false;
      config.currentValue = '1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports minor and major upgrades for ranged versions', async () => {
      config.currentValue = '~0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('ignores pinning for ranges when other upgrade exists', async () => {
      config.currentValue = '~0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades minor ranged versions', async () => {
      config.currentValue = '~1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('widens minor ranged versions if configured', async () => {
      config.currentValue = '~1.3.0';
      config.rangeStrategy = 'widen';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('replaces minor complex ranged versions if configured', async () => {
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.rangeStrategy = 'replace';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('widens major ranged versions if configured', async () => {
      config.currentValue = '^2.0.0';
      config.rangeStrategy = 'widen';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('replaces major complex ranged versions if configured', async () => {
      config.currentValue = '^1.0.0 || ^2.0.0';
      config.rangeStrategy = 'replace';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('pins minor ranged versions', async () => {
      config.currentValue = '^1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('uses the locked version for pinning', async () => {
      config.currentValue = '^1.0.0';
      config.lockedVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('ignores minor ranged versions when not pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });
    it('upgrades tilde ranges', async () => {
      config.rangeStrategy = 'pin';
      config.currentValue = '~1.3.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades .x minor ranges', async () => {
      config.currentValue = '1.3.x';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~1.3.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades .x major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades .x minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades .x complex minor ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.2.x - 1.3.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades shorthand major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades shorthand minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades multiple tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~0.7.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades multiple caret ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^0.7.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports complex ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '^0.7.0 || ^0.8.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(2);
      expect(res.updates[0]).toMatchSnapshot();
    });
    it('supports complex major ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '^1.0.0 || ^2.0.0';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports complex major hyphen ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.x - 2.x';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('widens .x OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.x || 2.x';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('widens stanndalone major OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1 || 2';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports complex tilde ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('returns nothing for greater than ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '>= 0.7.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });
    it('upgrades less than equal ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 0.7.2';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 0.7.2';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades less than major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades less than equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.3';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades less than equal major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.respectLatest = false;
      config.currentValue = '<= 1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('upgrades major less than equal ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toEqual('<= 1.4.1');
    });
    it('upgrades major less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toEqual('< 2.0.0');
    });
    it('upgrades major greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 < 1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toEqual('>= 0.5.0 < 2.0.0');
    });
    it('upgrades minor greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 <0.8';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toEqual('>= 0.5.0 <0.10');
      expect(res.updates[1].newValue).toEqual('>= 0.5.0 <1.5');
    });
    it('upgrades minor greater than less than equals ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 <= 0.8.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toEqual('>= 0.5.0 <= 0.9.7');
      expect(res.updates[1].newValue).toEqual('>= 0.5.0 <= 1.4.1');
    });
    it('rejects reverse ordered less than greater than', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '<= 0.8.0 >= 0.5.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
    });
    it('supports > latest versions if configured', async () => {
      config.respectLatest = false;
      config.currentValue = '1.4.1';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('should ignore unstable versions if the current version is stable', async () => {
      config.currentValue = '2.5.16';
      config.depName = 'vue';
      config.purl = 'pkg:npm/vue';
      nock('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });
    it('should allow unstable versions if the ignoreUnstable=false', async () => {
      config.currentValue = '2.5.16';
      config.ignoreUnstable = false;
      config.depName = 'vue';
      config.purl = 'pkg:npm/vue';
      nock('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toEqual('2.5.17-beta.0');
    });
    it('should allow unstable versions if the current version is unstable', async () => {
      config.currentValue = '3.1.0-dev.20180731';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toEqual('3.1.0-dev.20180813');
    });
    it('should not jump unstable versions', async () => {
      config.currentValue = '3.0.1-insiders.20180726';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toEqual('3.0.1');
    });
    it('should follow dist-tag even if newer version exists', async () => {
      config.currentValue = '3.0.1-insiders.20180713';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      config.followTag = 'insiders';
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toEqual('3.0.1-insiders.20180726');
    });
    it('should roll back to dist-tag if current version is higher', async () => {
      config.currentValue = '3.1.0-dev.20180813';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      config.followTag = 'insiders';
      config.rollbackPrs = true;
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toEqual('3.0.1-insiders.20180726');
    });
    it('should jump unstable versions if followTag', async () => {
      config.currentValue = '3.0.0-insiders.20180706';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      config.followTag = 'insiders';
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toEqual('3.0.1-insiders.20180726');
    });
    it('should update nothing if current version is dist-tag', async () => {
      config.currentValue = '3.0.1-insiders.20180726';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      config.followTag = 'insiders';
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });
    it('should warn if no version matches dist-tag', async () => {
      config.currentValue = '3.0.1-dev.20180726';
      config.depName = 'typescript';
      config.purl = 'pkg:npm/typescript';
      config.followTag = 'foo';
      nock('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(0);
      expect(res.warnings).toHaveLength(1);
      expect(res.warnings[0].message).toEqual(
        "Can't find version with tag foo for typescript"
      );
    });
    it('should treat zero zero tilde ranges as 0.0.x', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~0.0.34';
      config.depName = '@types/helmet';
      config.purl = 'pkg:npm/%40types/helmet';
      nock('https://registry.npmjs.org')
        .get('/@types%2Fhelmet')
        .reply(200, helmetJson);
      expect((await lookup.lookupUpdates(config)).updates).toEqual([]);
    });
    it('should treat zero zero caret ranges as pinned', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^0.0.34';
      config.depName = '@types/helmet';
      config.purl = 'pkg:npm/%40types/helmet';
      nock('https://registry.npmjs.org')
        .get('/@types%2Fhelmet')
        .reply(200, helmetJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('should downgrade from missing versions', async () => {
      config.currentValue = '1.16.1';
      config.depName = 'coffeelint';
      config.purl = 'pkg:npm/coffeelint';
      config.rollbackPrs = true;
      nock('https://registry.npmjs.org')
        .get('/coffeelint')
        .reply(200, coffeelintJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0]).toMatchSnapshot();
    });
    it('should upgrade to only one major', async () => {
      config.currentValue = '1.0.0';
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(2);
    });
    it('should upgrade to two majors', async () => {
      config.currentValue = '1.0.0';
      config.separateMultipleMajor = true;
      config.depName = 'webpack';
      config.purl = 'pkg:npm/webpack';
      nock('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(3);
    });
    it('does not jump  major unstable', async () => {
      config.currentValue = '^4.4.0-canary.3';
      config.rangeStrategy = 'replace';
      config.depName = 'next';
      config.purl = 'pkg:npm/next';
      nock('https://registry.npmjs.org')
        .get('/next')
        .reply(200, nextJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });
    it('supports in-range caret updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '^1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports in-range tilde updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports in-range tilde patch updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.depName = 'q';
      config.separateMinorPatch = true;
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports in-range gte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('supports majorgte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=0.9.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('rejects in-range unsupported operator', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('rejects non-fully specified in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '1.x';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('rejects complex range in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '^0.9.0 || ^1.0.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('replaces non-range in-range updates', async () => {
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      config.packageFile = 'package.json';
      config.rangeStrategy = 'bump';
      config.currentValue = '1.0.0';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('handles github 404', async () => {
      config.depName = 'foo';
      config.purl = 'pkg:github/some/repo';
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';
      nock('https://pypi.org')
        .get('/pypi/foo/json')
        .reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('handles pypi 404', async () => {
      config.depName = 'foo';
      config.purl = 'pkg:pypi/foo';
      config.packageFile = 'requirements.txt';
      config.currentValue = '1.0.0';
      nock('https://api.github.com')
        .get('/repos/some/repo/git/refs/tags?per_page=100')
        .reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('handles packagist', async () => {
      config.depName = 'foo/bar';
      config.purl = 'pkg:packagist/foo/bar';
      config.packageFile = 'composer.json';
      config.currentValue = '1.0.0';
      nock('https://packagist.org')
        .get('/packages/foo/bar.json')
        .reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('handles unknown purl', async () => {
      config.depName = 'foo';
      config.purl = 'pkg:typo/some/repo';
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot();
    });
    it('handles PEP440', async () => {
      config.manager = 'pip_requirements';
      config.versionScheme = 'pep440';
      config.rangeStrategy = 'pin';
      config.lockedVersion = '0.9.4';
      config.currentValue = '~=0.9';
      config.depName = 'q';
      // TODO: we are using npm as source, since purl for pypi is not implimented
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
    });
    it('returns complex object', async () => {
      config.currentValue = '1.3.0';
      config.depName = 'q';
      config.purl = 'pkg:npm/q';
      nock('https://registry.npmjs.org')
        .get('/q')
        .reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(res.sourceUrl).toBeDefined();
    });
    it('ignores deprecated', async () => {
      config.currentValue = '1.3.0';
      config.depName = 'q2';
      config.purl = 'pkg:npm/q2';
      const returnJson = JSON.parse(JSON.stringify(qJson));
      returnJson.name = 'q2';
      returnJson.versions['1.4.1'].deprecated = 'true';
      nock('https://registry.npmjs.org')
        .get('/q2')
        .reply(200, returnJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(res.updates[0].toVersion).toEqual('1.4.0');
    });
    it('skips unsupported values', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('skips undefined values', async () => {
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('handles digest pin', async () => {
      config.currentValue = '8.0.0';
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      config.pinDigests = true;
      docker.getPkgReleases.mockReturnValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      docker.getDigest.mockReturnValueOnce('sha256:abcdef1234567890');
      docker.getDigest.mockReturnValueOnce('sha256:0123456789abcdef');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    ['8.1.0', '8.1', '8'].forEach(currentValue => {
      it('skips uncompatible versions for ' + currentValue, async () => {
        config.currentValue = currentValue;
        config.depName = 'node';
        config.purl = 'pkg:docker/node';
        config.versionScheme = 'docker';
        docker.getPkgReleases.mockReturnValueOnce({
          releases: [
            { version: '8.1.0' },
            { version: '8.1.5' },
            { version: '8.1' },
            { version: '8.2.0' },
            { version: '8.2.5' },
            { version: '8.2' },
            { version: '8' },
            { version: '9.0' },
            { version: '9' },
          ],
        });
        const res = await lookup.lookupUpdates(config);
        expect(res).toMatchSnapshot();
      });
    });
    it('handles digest pin for up to date version', async () => {
      config.currentValue = '8.1.0';
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      config.pinDigests = true;
      docker.getPkgReleases.mockReturnValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      docker.getDigest.mockReturnValueOnce('sha256:abcdef1234567890');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('handles digest pin for non-version', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      config.pinDigests = true;
      docker.getPkgReleases.mockReturnValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
          {
            version: 'alpine',
          },
        ],
      });
      docker.getDigest.mockReturnValueOnce('sha256:abcdef1234567890');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('handles digest lookup failure', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      config.pinDigests = true;
      docker.getPkgReleases.mockReturnValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
          {
            version: 'alpine',
          },
        ],
      });
      docker.getDigest.mockReturnValueOnce(null);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });
    it('handles digest update', async () => {
      config.currentValue = '8.0.0';
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      config.currentDigest = 'sha256:zzzzzzzzzzzzzzz';
      config.pinDigests = true;
      docker.getPkgReleases.mockReturnValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      docker.getDigest.mockReturnValueOnce('sha256:abcdef1234567890');
      docker.getDigest.mockReturnValueOnce('sha256:0123456789abcdef');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('handles digest update for non-version', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.purl = 'pkg:docker/node';
      config.currentDigest = 'sha256:zzzzzzzzzzzzzzz';
      config.pinDigests = true;
      docker.getPkgReleases.mockReturnValueOnce({
        releases: [
          {
            version: 'alpine',
          },
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      docker.getDigest.mockReturnValueOnce('sha256:abcdef1234567890');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });
  });
});
