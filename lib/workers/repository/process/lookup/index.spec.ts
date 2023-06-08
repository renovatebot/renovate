import * as hostRules from '../../../../../lib/util/host-rules';
import { Fixtures } from '../../../../../test/fixtures';
import * as httpMock from '../../../../../test/http-mock';
import { getConfig, partial } from '../../../../../test/util';
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
import type { HostRule } from '../../../../types';
import * as memCache from '../../../../util/cache/memory';
import * as githubGraphql from '../../../../util/github/graphql';
import { initConfig, resetConfig } from '../../../../util/merge-confidence';
import * as McApi from '../../../../util/merge-confidence';
import type { LookupUpdateConfig } from './types';
import * as lookup from '.';

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

let config: LookupUpdateConfig;

describe('workers/repository/process/lookup/index', () => {
  const getGithubReleases = jest.spyOn(
    GithubReleasesDatasource.prototype,
    'getReleases'
  );

  const getDockerReleases = jest.spyOn(
    DockerDatasource.prototype,
    'getReleases'
  );

  const getDockerDigest = jest.spyOn(DockerDatasource.prototype, 'getDigest');

  beforeEach(() => {
    // TODO: fix wrong tests
    jest.resetAllMocks();
    // TODO: fix types #7154
    config = partial<LookupUpdateConfig>(getConfig() as never);
    config.manager = 'npm';
    config.versioning = npmVersioningId;
    config.rangeStrategy = 'replace';
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
  afterEach(() => {
    httpMock.clear(false);
    hostRules.clear();
  });

  describe('.lookupUpdates()', () => {
    it('returns null if unknown datasource', async () => {
      config.packageName = 'some-dep';
      config.datasource = 'does not exist';
      expect((await lookup.lookupUpdates(config)).updates).toEqual([]);
    });

    it('returns rollback for pinned version', async () => {
      config.currentValue = '0.9.99';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '0.9.7', updateType: 'rollback' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('returns rollback for ranged version', async () => {
      config.currentValue = '^0.9.99';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '^0.9.7', updateType: 'rollback' },
      ]);
    });

    it('supports minor and major upgrades for tilde ranges', async () => {
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '^0.9.0', updateType: 'minor' },
        { newValue: '^1.0.0', updateType: 'major' },
      ]);
    });

    it('supports lock file updates mixed with regular updates', async () => {
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'update-lockfile';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.separateMinorPatch = true;
      config.lockedVersion = '0.4.0';
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { isLockfileUpdate: true, newValue: '^0.4.0', updateType: 'patch' },
        { newValue: '^0.9.0', updateType: 'minor' },
        { newValue: '^1.0.0', updateType: 'major' },
      ]);
    });

    it('returns multiple updates if grouping but separateMajorMinor=true', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
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
      config.packageName = 'q';
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
      config.packageName = 'q';
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
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '^0.9.0', updateType: 'minor' },
        { newValue: '^1.0.0', updateType: 'major' },
      ]);
    });

    it('enforces allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('enforces allowedVersions with regex', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '/^0/';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('enforces allowedVersions with negative regex', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '!/^1/';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('falls back to semver syntax allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.packageName = 'q';
      config.versioning = dockerVersioningId; // this doesn't make sense but works for this test
      config.datasource = NpmDatasource.id; // this doesn't make sense but works for this test
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('falls back to pep440 syntax allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '==0.9.4';
      config.packageName = 'q';
      config.versioning = poetryVersioningId; // this doesn't make sense but works for this test
      config.datasource = NpmDatasource.id; // this doesn't make sense but works for this test
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(1);
    });

    it('skips invalid allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = 'less than 1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      await expect(lookup.lookupUpdates(config)).rejects.toThrow(
        Error(CONFIG_VALIDATION)
      );
    });

    it('returns patch update even if separate patches not configured', async () => {
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
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
      config.packageName = 'q';
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
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '0.9.7', updateType: 'patch' },
        { newValue: '1.4.1', updateType: 'major' },
      ]);
    });

    it('returns patch minor and major', async () => {
      config.separateMinorPatch = true;
      config.currentValue = '0.8.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
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
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '^1.0.0', updateType: 'major' },
      ]);
    });

    it('disables major release separation (minor)', async () => {
      config.separateMajorMinor = false;
      config.currentValue = '1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('uses minimum version for vulnerabilityAlerts', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = (await lookup.lookupUpdates(config)).updates;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });

    it('supports minor and major upgrades for ranged versions', async () => {
      config.currentValue = '~0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '0.4.4', updateType: 'pin' },
        { newValue: '~0.9.0', updateType: 'minor' },
        { newValue: '~1.4.0', updateType: 'major' },
      ]);
    });

    it.each`
      strategy | updates
      ${'pin'} | ${[{ newValue: '0.4.0', updateType: 'pin' }]}
    `(
      'supports for x-range-all for replaceStrategy = $strategy (with lockfile) abcd',
      async ({ strategy, updates }) => {
        config.currentValue = '*';
        config.rangeStrategy = strategy;
        config.lockedVersion = '0.4.0';
        config.packageName = 'q';
        config.datasource = NpmDatasource.id;
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/q')
          .reply(200, qJson);
        expect(await lookup.lookupUpdates(config)).toMatchObject({ updates });
      }
    );

    it.each`
      strategy
      ${'widen'}
      ${'bump'}
      ${'replace'}
    `(
      'doesnt offer updates for x-range-all (with lockfile) when replaceStrategy = $strategy',
      async ({ strategy }) => {
        config.currentValue = 'x';
        config.rangeStrategy = strategy;
        config.lockedVersion = '0.4.0';
        config.packageName = 'q';
        config.datasource = NpmDatasource.id;
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/q')
          .reply(200, qJson);
        expect((await lookup.lookupUpdates(config)).updates).toEqual([]);
      }
    );

    it('supports pinning for x-range-all (no lockfile)', async () => {
      config.currentValue = '*';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect(await lookup.lookupUpdates(config)).toMatchObject({
        updates: [{ newValue: '1.4.1', updateType: 'pin' }],
      });
    });

    it('covers pinning an unsupported x-range-all value', async () => {
      config.currentValue = '';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toEqual([]);
    });

    it.each`
      strategy
      ${'widen'}
      ${'bump'}
      ${'update-lockfile'}
      ${'replace'}
    `(
      'doesnt offer updates for x-range-all (no lockfile) when replaceStrategy = $strategy',
      async ({ strategy }) => {
        config.currentValue = 'X';
        config.rangeStrategy = strategy;
        config.packageName = 'q';
        config.datasource = NpmDatasource.id;
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/q')
          .reply(200, qJson);
        expect((await lookup.lookupUpdates(config)).updates).toEqual([]);
      }
    );

    it('ignores pinning for ranges when other upgrade exists', async () => {
      config.currentValue = '~0.9.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '0.9.7', updateType: 'pin' },
        { newValue: '~1.4.0', updateType: 'major' },
      ]);
    });

    it('upgrades minor ranged versions', async () => {
      config.currentValue = '~1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.0.1', updateType: 'pin' },
        { newValue: '~1.4.0', updateType: 'minor' },
      ]);
    });

    it('handles update-lockfile', async () => {
      config.currentValue = '^1.2.1';
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'update-lockfile';
      config.packageName = 'q';
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
      config.packageName = 'q';
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
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toEqual([
        {
          bucket: 'non-major',
          isLockfileUpdate: true,
          isRange: true,
          newMajor: 1,
          newMinor: 2,
          newValue: '~1.2.0',
          newVersion: '1.2.1',
          releaseTimestamp: '2015-04-25T22:25:48.180Z',
          updateType: 'patch',
        },
      ]);
    });

    it('handles unconstrainedValue values', async () => {
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'update-lockfile';
      config.packageName = 'q';
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
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '~1.3.0 || ~1.4.0', updateType: 'minor' },
      ]);
    });

    it('replaces minor complex ranged versions if configured', async () => {
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.rangeStrategy = 'replace';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '~1.4.0', updateType: 'minor' },
      ]);
    });

    it('widens major ranged versions if configured', async () => {
      config.currentValue = '^2.0.0';
      config.rangeStrategy = 'widen';
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '^2.0.0 || ^3.0.0', updateType: 'major' },
      ]);
    });

    it('replaces major complex ranged versions if configured', async () => {
      config.currentValue = '^1.0.0 || ^2.0.0';
      config.rangeStrategy = 'replace';
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '^3.0.0', updateType: 'major' },
      ]);
    });

    it('pins minor ranged versions', async () => {
      config.currentValue = '^1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.4.1', updateType: 'pin' },
      ]);
    });

    it('uses the locked version for pinning', async () => {
      config.currentValue = '^1.0.0';
      config.lockedVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.0.0', updateType: 'pin' },
      ]);
    });

    it('ignores minor ranged versions when not pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('ignores minor ranged versions when locked', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^1.0.0';
      config.lockedVersion = '1.1.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('upgrades tilde ranges', async () => {
      config.rangeStrategy = 'pin';
      config.currentValue = '~1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.3.0', updateType: 'pin' },
        { newValue: '~1.4.0', updateType: 'minor' },
      ]);
    });

    it('upgrades .x minor ranges', async () => {
      config.currentValue = '1.3.x';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.3.0', updateType: 'pin' },
        { newValue: '1.4.x', updateType: 'minor' },
      ]);
    });

    it('upgrades tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '~1.4.0', updateType: 'minor' },
      ]);
    });

    it('upgrades .x major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.x', updateType: 'major' },
      ]);
    });

    it('upgrades .x minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.4.x', updateType: 'minor' },
      ]);
    });

    it('upgrades .x complex minor ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.2.x - 1.3.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.2.x - 1.4.x', updateType: 'minor' },
      ]);
    });

    it('upgrades shorthand major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1', updateType: 'major' },
      ]);
    });

    it('upgrades shorthand minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.4', updateType: 'minor' },
      ]);
    });

    it('upgrades multiple tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~0.7.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '~0.9.0', updateType: 'minor' },
        { newValue: '~1.4.0', updateType: 'major' },
      ]);
    });

    it('upgrades multiple caret ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^0.7.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '^0.9.0', updateType: 'minor' },
        { newValue: '^1.0.0', updateType: 'major' },
      ]);
    });

    it('supports complex ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '^0.7.0 || ^0.8.0';
      config.packageName = 'q';
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
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          newValue: '^1.0.0 || ^2.0.0 || ^3.0.0',
          updateType: 'major',
        },
      ]);
    });

    it('supports complex major hyphen ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.x - 2.x';
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.x - 3.x', updateType: 'major' },
      ]);
    });

    it('widens .x OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.x || 2.x';
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.x || 2.x || 3.x', updateType: 'major' },
      ]);
    });

    it('widens stanndalone major OR ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1 || 2';
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1 || 2 || 3', updateType: 'major' },
      ]);
    });

    it('supports complex tilde ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '~1.2.0 || ~1.3.0 || ~1.4.0', updateType: 'minor' },
      ]);
    });

    it('returns nothing for greater than ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '>= 0.7.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('upgrades less than equal ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 0.7.2';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '<= 0.9.7', updateType: 'minor' },
        { newValue: '<= 1.4.1', updateType: 'major' },
      ]);
    });

    it('upgrades less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 0.7.2';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '< 0.9.8', updateType: 'minor' },
        { newValue: '< 1.4.2', updateType: 'major' },
      ]);
    });

    it('upgrades less than major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '< 2', updateType: 'major' },
      ]);
    });

    it('upgrades less than equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.3';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '<= 1.4', updateType: 'minor' },
      ]);
    });

    it('upgrades equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '=1.3.1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '=1.4.1', updateType: 'minor' },
      ]);
    });

    it('upgrades less than equal major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.respectLatest = false;
      config.currentValue = '<= 1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '<= 2', updateType: 'major' },
      ]);
    });

    it('upgrades major less than equal ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('<= 1.4.1');
    });

    it('upgrades major less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('< 2.0.0');
    });

    it('upgrades major greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 < 1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchSnapshot();
      expect(res.updates[0].newValue).toBe('>= 0.5.0 < 2.0.0');
    });

    it('upgrades minor greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 <0.8';
      config.packageName = 'q';
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
      config.packageName = 'q';
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
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchObject([]);
    });

    it('supports > latest versions if configured', async () => {
      config.respectLatest = false;
      config.currentValue = '1.4.1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '2.0.3', updateType: 'major' },
      ]);
    });

    it('should ignore unstable versions if the current version is stable', async () => {
      config.currentValue = '2.5.16';
      config.packageName = 'vue';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/vue')
        .reply(200, vueJson);
      expect((await lookup.lookupUpdates(config)).updates).toHaveLength(0);
    });

    it('should ignore unstable versions from datasource', async () => {
      config.currentValue = '1.4.4';
      config.packageName = 'some/action';
      config.datasource = GithubReleasesDatasource.id;
      getGithubReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.4.4' },
          { version: '2.0.0' },
          { version: '2.1.0', isStable: false },
        ],
      });
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '2.0.0', updateType: 'major' },
      ]);
    });

    it('should return pendingChecks', async () => {
      config.currentValue = '1.4.4';
      config.packageName = 'some/action';
      config.datasource = GithubReleasesDatasource.id;
      config.minimumReleaseAge = '14 days';
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
      config.packageName = 'some/action';
      config.datasource = GithubReleasesDatasource.id;
      config.minimumReleaseAge = '3 days';
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
      config.packageName = 'vue';
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
      config.packageName = 'typescript';
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
      config.packageName = 'typescript';
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
      config.packageName = '@types/helmet';
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
      config.packageName = '@types/helmet';
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
      config.packageName = 'typescript';
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
      config.packageName = 'typescript';
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
      config.packageName = 'typescript';
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
      config.packageName = 'typescript';
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
      config.packageName = 'typescript';
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
        "Can't find version with tag foo for npm package typescript"
      );
    });

    it('should warn if no digest could be found but there is a current digest', async () => {
      config.currentValue = 'v1.0.0';
      config.currentDigest = 'bla';
      config.digestOneAndOnly = true;
      config.packageName = 'angular/angular';
      config.datasource = GithubTagsDatasource.id;

      // Only mock calls once so that the second invocation results in
      // no digest being computable.
      jest.spyOn(githubGraphql, 'queryReleases').mockResolvedValueOnce([]);
      jest.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v2.0.0',
          gitRef: 'v2.0.0',
          releaseTimestamp: '2022-01-01',
          hash: 'abc',
        },
      ]);

      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
      expect(res.warnings).toHaveLength(1);
      expect(res.warnings[0]).toEqual({
        message:
          'Could not determine new digest for update (datasource: github-tags)',
        topic: 'angular/angular',
      });
    });

    describe('pinning enabled but no existing digest', () => {
      it('should not warn if no new digest could be found', async () => {
        config.currentValue = 'v1.0.0';
        config.digestOneAndOnly = true;
        config.packageName = 'angular/angular';
        config.pinDigests = true;
        config.datasource = GithubTagsDatasource.id;

        // Only mock calls once so that the second invocation results in
        // no digest being computable.
        jest.spyOn(githubGraphql, 'queryReleases').mockResolvedValueOnce([]);
        jest.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
          {
            version: 'v2.0.0',
            gitRef: 'v2.0.0',
            releaseTimestamp: '2022-01-01',
            hash: 'abc',
          },
        ]);

        const res = await lookup.lookupUpdates(config);
        expect(res.updates).toHaveLength(0);
        expect(res.warnings).toHaveLength(0);
      });
    });

    it('should treat zero zero tilde ranges as 0.0.x', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~0.0.34';
      config.packageName = '@types/helmet';
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
      config.packageName = '@types/helmet';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/@types%2Fhelmet')
        .reply(200, helmetJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '^0.0.35', updateType: 'patch' },
      ]);
    });

    it('should downgrade from missing versions', async () => {
      config.currentValue = '1.16.1';
      config.packageName = 'coffeelint';
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
      config.packageName = 'webpack';
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
      config.packageName = 'webpack';
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
      config.packageName = 'next';
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
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '^1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports in-range tilde updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.packageName = 'q';
      config.separateMinorPatch = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '~1.0.1', updateType: 'patch' },
        { newValue: '~1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports in-range tilde patch updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.packageName = 'q';
      config.separateMinorPatch = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '~1.0.1', updateType: 'patch' },
        { newValue: '~1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports in-range gte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '>=1.4.1', updateType: 'minor' },
      ]);
    });

    it('supports majorgte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=0.9.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.separateMajorMinor = false;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '>=1.4.1', updateType: 'major' },
      ]);
    });

    it('rejects in-range unsupported operator', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('rejects non-fully specified in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '1.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('rejects complex range in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '^0.9.0 || ^1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('replaces non-range in-range updates', async () => {
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.packageFile = 'package.json';
      config.rangeStrategy = 'bump';
      config.currentValue = '1.0.0';
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        { newValue: '1.4.1', updateType: 'minor' },
      ]);
    });

    it('handles github 404', async () => {
      config.packageName = 'foo';
      config.datasource = GithubTagsDatasource.id;
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';
      httpMock.scope('https://pypi.org').get('/pypi/foo/json').reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('handles pypi 404', async () => {
      config.packageName = 'foo';
      config.datasource = PypiDatasource.id;
      config.packageFile = 'requirements.txt';
      config.currentValue = '1.0.0';
      httpMock
        .scope('https://api.github.com')
        .get('/repos/some/repo/git/refs/tags?per_page=100')
        .reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('handles packagist', async () => {
      config.packageName = 'foo/bar';
      config.datasource = PackagistDatasource.id;
      config.packageFile = 'composer.json';
      config.currentValue = '1.0.0';
      config.registryUrls = ['https://packagist.org'];
      httpMock
        .scope('https://packagist.org')
        .get('/packages/foo/bar.json')
        .reply(404);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('handles unknown datasource', async () => {
      config.packageName = 'foo';
      config.datasource = 'typo';
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('handles PEP440', async () => {
      config.manager = 'pip_requirements';
      config.versioning = pep440VersioningId;
      config.manager = 'pip_requirements';
      config.versioning = 'pep440';
      config.rangeStrategy = 'pin';
      config.lockedVersion = '0.9.4';
      config.currentValue = '~=0.9';
      config.packageName = 'q';
      // TODO: we are using npm as source to test pep440 (#9721)
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toMatchObject([
        { newValue: '==0.9.4', updateType: 'pin' },
        { newValue: '~=1.4', updateType: 'major' },
      ]);
    });

    it('returns complex object', async () => {
      config.currentValue = '1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });

    it('ignores deprecated', async () => {
      config.currentValue = '1.3.0';
      config.packageName = 'q2';
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
      config.packageName = 'q3';
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
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({ skipReason: 'invalid-value' });
    });

    it('skips undefined values', async () => {
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({ skipReason: 'invalid-value' });
    });

    it('handles digest pin', async () => {
      config.currentValue = '8.0.0';
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      getDockerDigest.mockResolvedValueOnce('sha256:0123456789abcdef');
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
      config.packageName = 'node';
      config.versioning = dockerVersioningId;
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
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
      config.packageName = 'node';
      config.versioning = dockerVersioningId;
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        registryUrl: 'https://index.docker.io',
        releases: [
          { version: '8.1.0' },
          { version: '8.1.5' },
          { version: '8.1' },
          { version: '8.2.0' },
          { version: '8.2.5' },
          { version: '8.2' },
          { version: '8' },
          { version: '9.0', registryUrl: 'https://other.registry' },
          { version: '9' },
        ],
      });
      const res = await lookup.lookupUpdates(config);
      expect(res).toMatchSnapshot({
        registryUrl: 'https://index.docker.io',
        updates: [
          { newValue: '8.2', updateType: 'minor' },
          {
            newValue: '9.0',
            updateType: 'major',
            registryUrl: 'https://other.registry',
          },
        ],
      });
    });

    it('skips uncompatible versions for 8', async () => {
      config.currentValue = '8';
      config.packageName = 'node';
      config.versioning = dockerVersioningId;
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
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
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
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
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      getDockerReleases.mockResolvedValueOnce({
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
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
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
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      config.pinDigests = true;
      getDockerReleases.mockResolvedValueOnce({
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
      getDockerDigest.mockResolvedValueOnce(null);
      const res = await lookup.lookupUpdates(config);
      expect(res.updates).toHaveLength(0);
    });

    it('handles digest update', async () => {
      config.currentValue = '8.0.0';
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      config.currentDigest = 'sha256:zzzzzzzzzzzzzzz';
      config.pinDigests = true;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '8.0.0',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      getDockerDigest.mockResolvedValueOnce('sha256:0123456789abcdef');
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
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;
      config.currentDigest = 'sha256:zzzzzzzzzzzzzzz';
      config.pinDigests = true;
      getDockerReleases.mockResolvedValueOnce({
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
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
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
      config.packageName = 'some-path';
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
      config.packageName = 'q';
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

    it('handles replacements - name only without pinDigests enabled', async () => {
      config.packageName = 'openjdk';
      config.currentValue = '17.0.0';
      config.datasource = DockerDatasource.id;
      config.versioning = dockerVersioningId;
      // This config is normally set when packageRules are applied
      config.replacementName = 'eclipse-temurin';
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
          },
          {
            version: '18.0.0',
          },
        ],
      });

      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'major',
          newMajor: 18,
          newValue: '18.0.0',
          newVersion: '18.0.0',
        },
        {
          updateType: 'replacement',
          newName: 'eclipse-temurin',
          newValue: '17.0.0',
        },
      ]);
    });

    it('handles replacements - name only with pinDigests enabled', async () => {
      config.packageName = 'openjdk';
      config.currentValue = '17.0.0';
      config.pinDigests = true;
      config.datasource = DockerDatasource.id;
      config.versioning = dockerVersioningId;
      // This config is normally set when packageRules are applied
      config.replacementName = 'eclipse-temurin';
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
          },
          {
            version: '18.0.0',
          },
        ],
      });
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      getDockerDigest.mockResolvedValueOnce('sha256:0123456789abcdef');
      getDockerDigest.mockResolvedValueOnce('sha256:pin0987654321');

      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'major',
          newMajor: 18,
          newValue: '18.0.0',
          newVersion: '18.0.0',
          newDigest: 'sha256:abcdef1234567890',
        },
        {
          updateType: 'replacement',
          newName: 'eclipse-temurin',
          newValue: '17.0.0',
          newDigest: 'sha256:0123456789abcdef',
        },
        {
          isPinDigest: true,
          newDigest: 'sha256:pin0987654321',
          newValue: '17.0.0',
          updateType: 'pinDigest',
        },
      ]);
    });

    it('handles replacements - name only no version/tag', async () => {
      config.packageName = 'openjdk';
      config.currentValue = undefined;
      config.datasource = DockerDatasource.id;
      config.versioning = dockerVersioningId;
      // This config is normally set when packageRules are applied
      config.replacementName = 'eclipse-temurin';
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'replacement',
          newName: 'eclipse-temurin',
          newValue: undefined,
        },
      ]);
    });

    it('handles replacements - skips if package and replacement names match', async () => {
      config.packageName = 'openjdk';
      config.currentValue = undefined;
      config.datasource = DockerDatasource.id;
      config.replacementName = 'openjdk';
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([]);
    });

    it('handles replacements - name and version', async () => {
      config.currentValue = '1.4.1';
      config.packageName = 'q';
      // This config is normally set when packageRules are applied
      config.replacementName = 'r';
      config.replacementVersion = '2.0.0';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'replacement',
          newName: 'r',
          newValue: '2.0.0',
        },
      ]);
    });

    it('handles replacements - can template replacement name without a replacement version', async () => {
      config.packageName = 'mirror.some.org/library/openjdk';
      config.currentValue = '17.0.0';
      config.replacementNameTemplate = `{{{replace 'mirror.some.org/' 'new.registry.io/' packageName}}}`;
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
          },
          {
            version: '18.0.0',
          },
        ],
      });

      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'major',
          newMajor: 18,
          newValue: '18.0.0',
          newVersion: '18.0.0',
        },
        {
          updateType: 'replacement',
          newName: 'new.registry.io/library/openjdk',
          newValue: '17.0.0',
        },
      ]);
    });

    it('handles replacements - can template replacement name with a replacement version', async () => {
      config.packageName = 'mirror.some.org/library/openjdk';
      config.currentValue = '17.0.0';
      config.replacementNameTemplate = `{{{replace 'mirror.some.org/' 'new.registry.io/' packageName}}}`;
      config.replacementVersion = '18.0.0';
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
          },
          {
            version: '18.0.0',
          },
        ],
      });

      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'major',
          newMajor: 18,
          newValue: '18.0.0',
          newVersion: '18.0.0',
        },
        {
          updateType: 'replacement',
          newName: 'new.registry.io/library/openjdk',
          newValue: '18.0.0',
        },
      ]);
    });

    it('handles replacements - replacementName takes precedence over replacementNameTemplate', async () => {
      config.packageName = 'mirror.some.org/library/openjdk';
      config.currentValue = '17.0.0';
      config.replacementNameTemplate = `{{{replace 'mirror.some.org/' 'new.registry.io/' packageName}}}`;
      config.replacementName = 'eclipse-temurin';
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
          },
          {
            version: '18.0.0',
          },
        ],
      });

      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'major',
          newMajor: 18,
          newValue: '18.0.0',
          newVersion: '18.0.0',
        },
        {
          updateType: 'replacement',
          newName: 'eclipse-temurin',
          newValue: '17.0.0',
        },
      ]);
    });

    it('handles replacements - can perform replacement even for invalid versioning', async () => {
      config.packageName = 'adoptopenjdk/openjdk11';
      config.currentValue = 'alpine-jre';
      config.replacementName = 'eclipse-temurin';
      config.replacementVersion = '17.0.0-jre-alpine';
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: 'alpine-jre',
          },
        ],
      });

      expect((await lookup.lookupUpdates(config)).updates).toMatchObject([
        {
          updateType: 'replacement',
          newName: 'eclipse-temurin',
          newValue: '17.0.0-jre-alpine',
        },
      ]);
    });

    it('rollback for invalid version to last stable version', async () => {
      config.currentValue = '2.5.17';
      config.packageName = 'vue';
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

    describe('handles merge confidence', () => {
      const defaultApiBaseUrl = 'https://developer.mend.io/';
      const getMergeConfidenceSpy = jest.spyOn(
        McApi,
        'getMergeConfidenceLevel'
      );
      const hostRule: HostRule = {
        hostType: 'merge-confidence',
        token: 'some-token',
      };

      beforeEach(() => {
        hostRules.add(hostRule);
        initConfig();
        memCache.reset();
      });

      afterEach(() => {
        resetConfig();
      });

      it('gets a merge confidence level for a given update when corresponding packageRule is in use', async () => {
        const datasource = NpmDatasource.id;
        const packageName = 'webpack';
        const newVersion = '3.8.1';
        const currentValue = '3.7.0';
        config.packageRules = [{ matchConfidence: ['high'] }];
        config.currentValue = currentValue;
        config.packageName = packageName;
        config.datasource = datasource;
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/webpack')
          .reply(200, webpackJson);
        httpMock
          .scope(defaultApiBaseUrl)
          .get(
            `/api/mc/json/${datasource}/${packageName}/${currentValue}/${newVersion}`
          )
          .reply(200, { confidence: 'high' });

        const lookupUpdates = (await lookup.lookupUpdates(config)).updates;

        expect(lookupUpdates).toMatchObject([
          {
            mergeConfidenceLevel: `high`,
          },
        ]);
      });

      it('does not get a merge confidence level when no packageRule is set', async () => {
        config.currentValue = '3.7.0';
        config.packageName = 'webpack';
        config.datasource = NpmDatasource.id;
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/webpack')
          .reply(200, webpackJson);

        const lookupUpdates = (await lookup.lookupUpdates(config)).updates;

        expect(getMergeConfidenceSpy).toHaveBeenCalledTimes(0);
        expect(lookupUpdates).not.toMatchObject([
          {
            mergeConfidenceLevel: expect.anything(),
          },
        ]);
      });

      it('does not set merge confidence value when API is not in use', async () => {
        const datasource = NpmDatasource.id;
        config.packageRules = [{ matchConfidence: ['high'] }];
        config.currentValue = '3.7.0';
        config.packageName = 'webpack';
        config.datasource = datasource;
        hostRules.clear(); // reset merge confidence
        initConfig();
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/webpack')
          .reply(200, webpackJson);

        const lookupUpdates = (await lookup.lookupUpdates(config)).updates;

        expect(lookupUpdates).not.toMatchObject([
          {
            mergeConfidenceLevel: expect.anything(),
          },
        ]);
      });
    });
  });
});
