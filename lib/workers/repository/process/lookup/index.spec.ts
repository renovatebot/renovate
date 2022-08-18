import { Fixtures } from '../../../../../test/fixtures';
import * as httpMock from '../../../../../test/http-mock';
import { getConfig, mocked, partial } from '../../../../../test/util';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { DockerDatasource } from '../../../../modules/datasource/docker';
import { GitRefsDatasource } from '../../../../modules/datasource/git-refs';
import { GithubReleasesDatasource } from '../../../../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../../../../modules/datasource/github-tags';
import { NpmDatasource } from '../../../../modules/datasource/npm';
import { PackagistDatasource } from '../../../../modules/datasource/packagist';
import { PypiDatasource } from '../../../../modules/datasource/pypi';
import { id as dockerVersioningId } from '../../../../modules/versioning/docker';
import { id as gitVersioningId } from '../../../../modules/versioning/git';
import { id as npmVersioningId } from '../../../../modules/versioning/npm';
import { id as pep440VersioningId } from '../../../../modules/versioning/pep440';
import { id as poetryVersioningId } from '../../../../modules/versioning/poetry';
import type { LookupUpdateConfig } from './types';
import * as lookup from '.';

jest.mock('../../../../modules/datasource/docker');

const fixtureRoot = '../../../../config/npm';
const qJson = {
  ...Fixtures.getJson('01.json', fixtureRoot),
  latestVersion: '1.4.1',
};

const helmetJson = Fixtures.get('02.json', fixtureRoot);
const coffeelintJson = Fixtures.get('coffeelint.json', fixtureRoot);
const nextJson = Fixtures.get('next.json', fixtureRoot);
const typescriptJson = Fixtures.get('typescript.json', fixtureRoot);
const vueJson = Fixtures.get('vue.json', fixtureRoot);
const webpackJson = Fixtures.get('webpack.json', fixtureRoot);

const docker = mocked(DockerDatasource.prototype);

let config: LookupUpdateConfig;

describe('workers/repository/process/lookup/index', () => {
  const getGithubReleases = jest.spyOn(
    GithubReleasesDatasource.prototype,
    'getReleases'
  );

  beforeEach(() => {
    // TODO: fix types #7154
    config = partial<LookupUpdateConfig>(getConfig() as never);
    config.manager = 'npm';
    config.versioning = npmVersioningId;
    config.rangeStrategy = 'replace';
    jest.resetAllMocks();
    jest
      .spyOn(GitRefsDatasource.prototype, 'getReleases')
      .mockResolvedValueOnce({
        releases: [{ version: 'master' }],
      });
    jest
      .spyOn(GitRefsDatasource.prototype, 'getDigest')
      .mockResolvedValueOnce('4b825dc642cb6eb9a060e54bf8d69288fbee4904');
  });

  // TODO: fix mocks
  afterEach(() => httpMock.clear(false));

  describe('.lookupUpdates()', () => {
    it('returns null if unknown datasource', async () => {
      config.depName = 'some-dep';
      config.datasource = 'does not exist';
      expect((await lookup.lookupUpdates(config)).updates).toEqual([]);
    });

    it('returns rollback for pinned version', async () => {
      config.currentValue = '0.9.99';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '0.9.7', updateType: 'rollback' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('returns rollback for ranged version', async () => {
      config.currentValue = '^0.9.99';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '^0.9.7', updateType: 'rollback' },
      ]);
    });

    it('supports minor and major upgrades for tilde ranges', async () => {
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '0.9.7', updateType: 'minor' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('supports lock file updates mixed with regular updates', async () => {
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'update-lockfile';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      config.separateMinorPatch = true;
      config.lockedVersion = '0.4.0';
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { isLockfileUpdate: true, newValue: '^0.4.0', updateType: 'patch' },
        { newValue: '^0.9.0', updateType: 'minor' },
        { newValue: '^1.0.0', updateType: 'major' },
      ]);
    });

    it('returns multiple updates if grouping but separateMajorMinor=true', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
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
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
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
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
    });

    it('returns both updates if automerging minor', async () => {
      config.minor = { automerge: true };
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '0.9.7', updateType: 'minor' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('enforces allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('enforces allowedVersions with regex', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '/^0/';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('enforces allowedVersions with negative regex', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '!/^1/';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('falls back to semver syntax allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.depName = 'q';
      config.versioning = dockerVersioningId; // this doesn't make sense but works for this test
      config.datasource = NpmDatasource.id; // this doesn't make sense but works for this test
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('falls back to pep440 syntax allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '==0.9.4';
      config.depName = 'q';
      config.versioning = poetryVersioningId; // this doesn't make sense but works for this test
      config.datasource = NpmDatasource.id; // this doesn't make sense but works for this test
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('skips invalid allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = 'less than 1';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      await expect(lookup.lookupUpdates(config)).rejects.toThrow(
        Error(CONFIG_VALIDATION)
      );
    });

    it('returns patch update even if separate patches not configured', async () => {
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(2);
      expect(res.updates[0].updateType).toBe('patch');
      expect(res.updates[1].updateType).toBe('major');
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
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].updateType).toBe('patch');
    });

    it('returns patch update if separateMinorPatch', async () => {
      config.separateMinorPatch = true;
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '0.9.7', updateType: 'patch' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('returns patch minor and major', async () => {
      config.separateMinorPatch = true;
      config.currentValue = '0.8.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(3);
      expect(res.updates).toMatchSnapshot();
    });

    it('disables major release separation (major)', async () => {
      config.separateMajorMinor = false;
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('disables major release separation (minor)', async () => {
      config.separateMajorMinor = false;
      config.currentValue = '1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('uses minimum version for vulnerabilityAlerts', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = (await lookup.lookupUpdates(config)).updates;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });

    it('supports minor and major upgrades for ranged versions', async () => {
      config.currentValue = '~0.4.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '0.9.7', updateType: 'minor' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('ignores pinning for ranges when other upgrade exists', async () => {
      config.currentValue = '~0.9.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '0.9.7', updateType: 'pin' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('upgrades minor ranged versions', async () => {
      config.currentValue = '~1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.0.1', updateType: 'pin' },
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('handles update-lockfile', async () => {
      config.currentValue = '^1.2.1';
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'update-lockfile';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].updateType).toBe('minor');
    });

    it('handles the in-range-only strategy and updates lockfile within range', async () => {
      config.currentValue = '^1.2.1';
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'in-range-only';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].updateType).toBe('minor');
    });

    it('handles the in-range-only strategy and discards changes not within range', async () => {
      config.currentValue = '~1.2.0';
      config.lockedVersion = '1.2.0';
      config.rangeStrategy = 'in-range-only';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toBeEmptyArray();
    });

    it('handles unconstrainedValue values', async () => {
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'update-lockfile';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchInlineSnapshot(`
        [
          {
            "bucket": "non-major",
            "isLockfileUpdate": true,
            "isRange": true,
            "newMajor": 1,
            "newMinor": 4,
            "newValue": undefined,
            "newVersion": "1.4.1",
            "releaseTimestamp": "2015-05-17T04:25:07.299Z",
            "updateType": "minor",
          },
        ]
      `);
      expect(res.updates[0].newValue).toBeUndefined();
      expect(res.updates[0].updateType).toBe('minor');
    });

    it('widens minor ranged versions if configured', async () => {
      config.currentValue = '~1.3.0';
      config.rangeStrategy = 'widen';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '~1.3.0 || ~1.4.0', updateType: 'minor' },
      ]);
    });

    it('replaces minor complex ranged versions if configured', async () => {
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.rangeStrategy = 'replace';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '~1.4.0', updateType: 'minor' },
      ]);
    });

    it('widens major ranged versions if configured', async () => {
      config.currentValue = '^2.0.0';
      config.rangeStrategy = 'widen';
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '^2.0.0 || ^3.0.0', updateType: 'major' },
      ]);
    });

    it('replaces major complex ranged versions if configured', async () => {
      config.currentValue = '^1.0.0 || ^2.0.0';
      config.rangeStrategy = 'replace';
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '^3.0.0', updateType: 'major' },
      ]);
    });

    it('pins minor ranged versions', async () => {
      config.currentValue = '^1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.4.1', updateType: 'pin' },
      ]);
    });

    it('uses the locked version for pinning', async () => {
      config.currentValue = '^1.0.0';
      config.lockedVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.0.0', updateType: 'pin' },
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('ignores minor ranged versions when not pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('ignores minor ranged versions when locked', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^1.0.0';
      config.lockedVersion = '1.1.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('upgrades tilde ranges', async () => {
      config.rangeStrategy = 'pin';
      config.currentValue = '~1.3.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.3.0', updateType: 'pin' },
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('upgrades .x minor ranges', async () => {
      config.currentValue = '1.3.x';
      config.rangeStrategy = 'pin';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.3.0', updateType: 'pin' },
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('upgrades tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~1.3.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '~1.4.0', updateType: 'minor' },
      ]);
    });

    it('upgrades .x major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0.x';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.x', updateType: 'major' },
      ]);
    });

    it('upgrades .x minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3.x';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.4.x', updateType: 'minor' },
      ]);
    });

    it('upgrades .x complex minor ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.2.x - 1.3.x';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.2.x - 1.4.x', updateType: 'minor' },
      ]);
    });

    it('upgrades shorthand major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1', updateType: 'major' },
      ]);
    });

    it('upgrades shorthand minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.4', updateType: 'minor' },
      ]);
    });

    it('upgrades multiple tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~0.7.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '~0.9.0', updateType: 'minor' },
        { newValue: '~1.4.0', updateType: 'major' },
      ]);
    });

    it('upgrades multiple caret ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^0.7.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '^0.9.0', updateType: 'minor' },
        { newValue: '^1.0.0', updateType: 'major' },
      ]);
    });

    it('supports complex ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '^0.7.0 || ^0.8.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(2);
      expect(res.updates[0]).toMatchSnapshot({
        newValue: '^0.7.0 || ^0.8.0 || ^0.9.0',
        updateType: 'minor',
      });
    });

    it('supports complex major ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '^1.0.0 || ^2.0.0';
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        {
          newValue: '^1.0.0 || ^2.0.0 || ^3.0.0',
          updateType: 'major',
        },
      ]);
    });

    it('supports complex major hyphen ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.x - 2.x';
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.x - 3.x', updateType: 'major' },
      ]);
    });

    it('widens .x OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.x || 2.x';
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.x || 2.x || 3.x', updateType: 'major' },
      ]);
    });

    it('widens stanndalone major OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1 || 2';
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1 || 2 || 3', updateType: 'major' },
      ]);
    });

    it('supports complex tilde ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '~1.2.0 || ~1.3.0 || ~1.4.0', updateType: 'minor' },
      ]);
    });

    it('returns nothing for greater than ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '>= 0.7.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('upgrades less than equal ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 0.7.2';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '<= 0.9.7', updateType: 'minor' },
        { newValue: '<= 1.4.1', updateType: 'major' },
      ]);
    });

    it('upgrades less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 0.7.2';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '< 0.9.8', updateType: 'minor' },
        { newValue: '< 1.4.2', updateType: 'major' },
      ]);
    });

    it('upgrades less than major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '< 2', updateType: 'major' },
      ]);
    });

    it('upgrades less than equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.3';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '<= 1.4', updateType: 'minor' },
      ]);
    });

    it('upgrades equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '=1.3.1';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '=1.4.1', updateType: 'minor' },
      ]);
    });

    it('upgrades less than equal major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.respectLatest = false;
      config.currentValue = '<= 1';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '<= 2', updateType: 'major' },
      ]);
    });

    it('upgrades major less than equal ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('<= 1.4.1');
    });

    it('upgrades major less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('< 2.0.0');
    });

    it('upgrades major greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 < 1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('>= 0.5.0 < 2.0.0');
    });

    it('upgrades minor greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 <0.8';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('>= 0.5.0 <0.10');
      expect(res.updates[1].newValue).toBe('>= 0.5.0 <1.5');
    });

    it('upgrades minor greater than less than equals ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 <= 0.8.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('>= 0.5.0 <= 0.9.7');
      expect(res.updates[1].newValue).toBe('>= 0.5.0 <= 1.4.1');
    });

    it('rejects reverse ordered less than greater than', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '<= 0.8.0 >= 0.5.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot([]);
    });

    it('supports > latest versions if configured', async () => {
      config.respectLatest = false;
      config.currentValue = '1.4.1';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '2.0.3', updateType: 'major' },
      ]);
    });

    it('should ignore unstable versions if the current version is stable', async () => {
      config.currentValue = '2.5.16';
      config.depName = 'vue';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('should ignore unstable versions from datasource', async () => {
      config.currentValue = '1.4.4';
      config.depName = 'some/action';
      config.datasource = GithubReleasesDatasource.id;
      getGithubReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.4.4' },
          { version: '2.0.0' },
          { version: '2.1.0', isStable: false },
        ],
      });
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '2.0.0', updateType: 'major' },
      ]);
    });

    it('should return pendingChecks', async () => {
      config.currentValue = '1.4.4';
      config.depName = 'some/action';
      config.datasource = GithubReleasesDatasource.id;
      config.stabilityDays = 14;
      config.internalChecksFilter = 'strict';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      getGithubReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.4.4' },
          { version: '1.4.5', releaseTimestamp: lastWeek.toISOString() },
          { version: '1.4.6', releaseTimestamp: yesterday.toISOString() },
        ],
      });
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newVersion).toBe('1.4.6');
      expect(res.updates[0].pendingChecks).toBeTrue();
    });

    it('should return pendingVersions', async () => {
      config.currentValue = '1.4.4';
      config.depName = 'some/action';
      config.datasource = GithubReleasesDatasource.id;
      config.stabilityDays = 3;
      config.internalChecksFilter = 'strict';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      getGithubReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.4.4' },
          { version: '1.4.5', releaseTimestamp: lastWeek.toISOString() },
          { version: '1.4.6', releaseTimestamp: yesterday.toISOString() },
        ],
      });
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newVersion).toBe('1.4.5');
      expect(res.updates[0].pendingVersions).toHaveLength(1);
    });

    it('should allow unstable versions if the ignoreUnstable=false', async () => {
      config.currentValue = '2.5.16';
      config.ignoreUnstable = false;
      config.respectLatest = false;
      config.depName = 'vue';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toBe('2.5.17-beta.0');
    });

    it('should allow unstable versions if the current version is unstable', async () => {
      config.currentValue = '3.1.0-dev.20180731';
      config.depName = 'typescript';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toBe('3.1.0-dev.20180813');
    });

    it('should not jump unstable versions', async () => {
      config.currentValue = '3.0.1-insiders.20180726';
      config.depName = 'typescript';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toBe('3.0.1');
    });

    it('should update pinned versions if updatePinnedDependencies=true', async () => {
      config.currentValue = '0.0.34';
      config.updatePinnedDependencies = true;
      config.depName = '@types/helmet';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/@types%2Fhelmet')
        .reply(200, helmetJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toBe('0.0.35');
    });

    it('should not update pinned versions if updatePinnedDependencies=false', async () => {
      config.currentValue = '0.0.34';
      config.updatePinnedDependencies = false;
      config.depName = '@types/helmet';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/@types%2Fhelmet')
        .reply(200, helmetJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });

    it('should follow dist-tag even if newer version exists', async () => {
      config.currentValue = '3.0.1-insiders.20180713';
      config.depName = 'typescript';
      config.datasource = NpmDatasource.id;
      config.followTag = 'insiders';
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toBe('3.0.1-insiders.20180726');
    });

    it('should roll back to dist-tag if current version is higher', async () => {
      config.currentValue = '3.1.0-dev.20180813';
      config.depName = 'typescript';
      config.datasource = NpmDatasource.id;
      config.followTag = 'insiders';
      config.rollbackPrs = true;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toBe('3.0.1-insiders.20180726');
    });

    it('should jump unstable versions if followTag', async () => {
      config.currentValue = '3.0.0-insiders.20180706';
      config.depName = 'typescript';
      config.datasource = NpmDatasource.id;
      config.followTag = 'insiders';
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0].newValue).toBe('3.0.1-insiders.20180726');
    });

    it('should update nothing if current version is dist-tag', async () => {
      config.currentValue = '3.0.1-insiders.20180726';
      config.depName = 'typescript';
      config.datasource = NpmDatasource.id;
      config.followTag = 'insiders';
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });

    it('should warn if no version matches dist-tag', async () => {
      config.currentValue = '3.0.1-dev.20180726';
      config.depName = 'typescript';
      config.datasource = NpmDatasource.id;
      config.followTag = 'foo';
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates).toHaveLength(0);
      expect(res.warnings).toHaveLength(1);
      expect(res.warnings[0].message).toBe(
        "Can't find version with tag foo for typescript"
      );
    });

    it('should treat zero zero tilde ranges as 0.0.x', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~0.0.34';
      config.depName = '@types/helmet';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/@types%2Fhelmet')
        .reply(200, helmetJson);
      expect((await lookup.lookupUpdates(config)).updates).toEqual([]);
    });

    it('should treat zero zero caret ranges as pinned', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^0.0.34';
      config.depName = '@types/helmet';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/@types%2Fhelmet')
        .reply(200, helmetJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '^0.0.35', updateType: 'patch' },
      ]);
    });

    it('should downgrade from missing versions', async () => {
      config.currentValue = '1.16.1';
      config.depName = 'coffeelint';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/coffeelint')
        .reply(200, coffeelintJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(1);
      expect(res.updates[0]).toMatchSnapshot();
    });

    it('should upgrade to only one major', async () => {
      config.currentValue = '1.0.0';
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(2);
    });

    it('should upgrade to two majors', async () => {
      config.currentValue = '1.0.0';
      config.separateMultipleMajor = true;
      config.depName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(3);
    });

    it('does not jump  major unstable', async () => {
      config.currentValue = '^4.4.0-canary.3';
      config.rangeStrategy = 'replace';
      config.depName = 'next';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/next')
        .reply(200, nextJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });

    it('supports in-range caret updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '^1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '^1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports in-range tilde updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.depName = 'q';
      config.separateMinorPatch = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '~1.0.1', updateType: 'patch' },
        { newValue: '~1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports in-range tilde patch updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.depName = 'q';
      config.separateMinorPatch = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '~1.0.1', updateType: 'patch' },
        { newValue: '~1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports in-range gte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '>=1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports majorgte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=0.9.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      config.separateMajorMinor = false;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '>=1.4.1', updateType: 'major' },
      ]);
    });

    it('rejects in-range unsupported operator', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([]);
    });

    it('rejects non-fully specified in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '1.x';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([]);
    });

    it('rejects complex range in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '^0.9.0 || ^1.0.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([]);
    });

    it('replaces non-range in-range updates', async () => {
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      config.packageFile = 'package.json';
      config.rangeStrategy = 'bump';
      config.currentValue = '1.0.0';
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('handles github 404', async () => {
      config.depName = 'foo';
      config.datasource = GithubTagsDatasource.id;
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';
      httpMock.scope('https://pypi.org').get('/pypi/foo/json').reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([]);
    });

    it('handles pypi 404', async () => {
      config.depName = 'foo';
      config.datasource = PypiDatasource.id;
      config.packageFile = 'requirements.txt';
      config.currentValue = '1.0.0';
      httpMock
        .scope('https://api.github.com')
        .get('/repos/some/repo/git/refs/tags?per_page=100')
        .reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([]);
    });

    it('handles packagist', async () => {
      config.depName = 'foo/bar';
      config.datasource = PackagistDatasource.id;
      config.packageFile = 'composer.json';
      config.currentValue = '1.0.0';
      config.registryUrls = ['https://packagist.org'];
      httpMock
        .scope('https://packagist.org')
        .get('/packages/foo/bar.json')
        .reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([]);
    });

    it('handles unknown datasource', async () => {
      config.depName = 'foo';
      config.datasource = 'typo';
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';
      expect((await lookup.lookupUpdates(config)).updates).toMatchSnapshot([]);
    });

    it('handles PEP440', async () => {
      config.manager = 'pip_requirements';
      config.versioning = pep440VersioningId;
      config.manager = 'pip_requirements';
      config.versioning = 'pep440';
      config.rangeStrategy = 'pin';
      config.lockedVersion = '0.9.4';
      config.currentValue = '~=0.9';
      config.depName = 'q';
      // TODO: we are using npm as source to test pep440 (#9721)
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot([
        { newValue: '==0.9.4', updateType: 'pin' },
        { newValue: '==0.9.7', updateType: 'patch' },
        { newValue: '==1.4.1', updateType: 'major' },
      ]);
    });

    it('returns complex object', async () => {
      config.currentValue = '1.3.0';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });

    it('ignores deprecated', async () => {
      config.currentValue = '1.3.0';
      config.depName = 'q2';
      config.datasource = NpmDatasource.id;
      const returnJson = JSON.parse(JSON.stringify(qJson));
      returnJson.name = 'q2';
      returnJson.versions['1.4.1'].deprecated = 'true';
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/q2')
        .reply(200, returnJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res.updates[0].newVersion).toBe('1.4.0');
    });

    it('is deprecated', async () => {
      config.currentValue = '1.3.0';
      config.depName = 'q3';
      config.datasource = NpmDatasource.id;
      const returnJson = {
        ...JSON.parse(JSON.stringify(qJson)),
        name: 'q3',
        deprecated: true,
        repository: { url: null, directory: 'test' },
      };

      httpMock
        .scope('https://registry.npmjs.org')
        .get('/q3')
        .reply(200, returnJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res.updates[0].newVersion).toBe('1.4.1');
    });

    it('skips unsupported values', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({ skipReason: 'invalid-value' });
    });

    it('skips undefined values', async () => {
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({ skipReason: 'invalid-value' });
    });

    it('handles digest pin', async () => {
      config.currentValue = '8.0.0';
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      docker.getReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      docker.getDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      docker.getDigest.mockResolvedValueOnce('sha256:0123456789abcdef');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        currentVersion: '8.0.0',
        isSingleVersion: true,
        updates: [
          {
            newDigest: 'sha256:abcdef1234567890',
            newValue: '8.1.0',
            updateType: 'minor',
          },
          {
            isPinDigest: true,
            newDigest: 'sha256:0123456789abcdef',
            newValue: '8.0.0',
            updateType: 'pinDigest',
          },
        ],
      });
    });

    it('skips uncompatible versions for 8.1.0', async () => {
      config.currentValue = '8.1.0';
      config.depName = 'node';
      config.versioning = dockerVersioningId;
      config.datasource = DockerDatasource.id;
      docker.getReleases.mockResolvedValueOnce({
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
      expect(res).toMatchSnapshot({
        updates: [{ newValue: '8.2.5', updateType: 'minor' }],
      });
    });

    it('skips uncompatible versions for 8.1', async () => {
      config.currentValue = '8.1';
      config.depName = 'node';
      config.versioning = dockerVersioningId;
      config.datasource = DockerDatasource.id;
      docker.getReleases.mockResolvedValueOnce({
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
      expect(res).toMatchSnapshot({
        updates: [
          { newValue: '8.2', updateType: 'minor' },
          { newValue: '9.0', updateType: 'major' },
        ],
      });
    });

    it('skips uncompatible versions for 8', async () => {
      config.currentValue = '8';
      config.depName = 'node';
      config.versioning = dockerVersioningId;
      config.datasource = DockerDatasource.id;
      docker.getReleases.mockResolvedValueOnce({
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
      expect(res).toMatchSnapshot({
        updates: [{ newValue: '9', updateType: 'major' }],
      });
    });

    it('handles digest pin for up to date version', async () => {
      config.currentValue = '8.1.0';
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      docker.getReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      docker.getDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        updates: [
          {
            isPinDigest: true,
            newDigest: 'sha256:abcdef1234567890',
            newValue: '8.1.0',
            updateType: 'pinDigest',
          },
        ],
      });
    });

    it('handles digest pin for non-version', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      docker.getReleases.mockResolvedValueOnce({
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
      docker.getDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        updates: [
          {
            isPinDigest: true,
            newDigest: 'sha256:abcdef1234567890',
            newValue: 'alpine',
            updateType: 'pinDigest',
          },
        ],
      });
    });

    it('handles digest lookup failure', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      docker.getReleases.mockResolvedValueOnce({
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
      docker.getDigest.mockResolvedValueOnce(null);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });

    it('handles digest update', async () => {
      config.currentValue = '8.0.0';
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      config.currentDigest = 'sha256:zzzzzzzzzzzzzzz';
      config.pinDigests = true;
      docker.getReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      docker.getDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      docker.getDigest.mockResolvedValueOnce('sha256:0123456789abcdef');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        updates: [
          {
            newDigest: 'sha256:abcdef1234567890',
            newValue: '8.1.0',
            updateType: 'minor',
          },
          {
            newDigest: 'sha256:0123456789abcdef',
            newValue: '8.0.0',
            updateType: 'digest',
          },
        ],
      });
    });

    it('handles digest update for non-version', async () => {
      config.currentValue = 'alpine';
      config.depName = 'node';
      config.datasource = DockerDatasource.id;
      config.currentDigest = 'sha256:zzzzzzzzzzzzzzz';
      config.pinDigests = true;
      docker.getReleases.mockResolvedValueOnce({
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
      docker.getDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        updates: [
          {
            newDigest: 'sha256:abcdef1234567890',
            newValue: 'alpine',
            updateType: 'digest',
          },
        ],
      });
    });

    it('handles git submodule update', async () => {
      config.depName = 'some-path';
      config.versioning = gitVersioningId;
      config.datasource = GitRefsDatasource.id;
      config.currentDigest = 'some-digest';

      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        updates: [
          {
            newDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            updateType: 'digest',
          },
        ],
        versioning: 'git',
      });
    });

    it('handles sourceUrl packageRules with version restrictions', async () => {
      config.currentValue = '0.9.99';
      config.depName = 'q';
      config.datasource = NpmDatasource.id;
      config.packageRules = [
        {
          matchSourceUrlPrefixes: ['https://github.com/kriskowal/q'],
          allowedVersions: '< 1.4.0',
        },
      ];
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        sourceUrl: 'https://github.com/kriskowal/q',
        updates: [{ newValue: '1.3.0', updateType: 'major' }],
      });
    });

    it('handles replacements', async () => {
      config.currentValue = '1.4.1';
      config.depName = 'q';
      // This config is normally set when packageRules are applied
      config.replacementName = 'r';
      config.replacementVersion = '2.0.0';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
    });

    it('rollback for invalid version to last stable version', async () => {
      config.currentValue = '2.5.17';
      config.depName = 'vue';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      config.ignoreUnstable = true;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      const res = (await lookup.lookupUpdates(config)).updates;
      expect(res).toEqual([
        {
          bucket: `rollback`,
          newMajor: 2,
          newValue: `2.5.16`,
          newVersion: `2.5.16`,
          updateType: `rollback`,
        },
      ]);
    });
  });
});
