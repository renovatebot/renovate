import { codeBlock } from 'common-tags';
import * as hostRules from '../../../../../lib/util/host-rules';
import { Fixtures } from '../../../../../test/fixtures';
import * as httpMock from '../../../../../test/http-mock';
import { partial } from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { supportedDatasources as presetSupportedDatasources } from '../../../../config/presets/internal/merge-confidence';
import type { AllConfig } from '../../../../config/types';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { CustomDatasource } from '../../../../modules/datasource/custom';
import { DockerDatasource } from '../../../../modules/datasource/docker';
import { GitRefsDatasource } from '../../../../modules/datasource/git-refs';
import { GithubReleasesDatasource } from '../../../../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../../../../modules/datasource/github-tags';
import { GoDatasource } from '../../../../modules/datasource/go';
import { MavenDatasource } from '../../../../modules/datasource/maven';
import { NpmDatasource } from '../../../../modules/datasource/npm';
import { PackagistDatasource } from '../../../../modules/datasource/packagist';
import { PypiDatasource } from '../../../../modules/datasource/pypi';
import { id as composerVersioningId } from '../../../../modules/versioning/composer';
import { id as debianVersioningId } from '../../../../modules/versioning/debian';
import { id as dockerVersioningId } from '../../../../modules/versioning/docker';
import { id as gitVersioningId } from '../../../../modules/versioning/git';
import { id as mavenVersioningId } from '../../../../modules/versioning/maven';
import { id as nodeVersioningId } from '../../../../modules/versioning/node';
import { id as npmVersioningId } from '../../../../modules/versioning/npm';
import { id as pep440VersioningId } from '../../../../modules/versioning/pep440';
import { id as poetryVersioningId } from '../../../../modules/versioning/poetry';
import type { HostRule } from '../../../../types';
import * as memCache from '../../../../util/cache/memory';
import { initConfig, resetConfig } from '../../../../util/merge-confidence';
import * as McApi from '../../../../util/merge-confidence';
import { Result } from '../../../../util/result';
import type { LookupUpdateConfig } from './types';
import * as lookup from '.';

const qJson = {
  ...Fixtures.getJson('01.json'),
  latestVersion: '1.4.1',
};

const helmetJson = Fixtures.get('02.json');
const coffeelintJson = Fixtures.get('coffeelint.json');
const nextJson = Fixtures.get('next.json');
const typescriptJson = Fixtures.get('typescript.json');
const vueJson = Fixtures.get('vue.json');
const webpackJson = Fixtures.get('webpack.json');

let config: LookupUpdateConfig;

describe('workers/repository/process/lookup/index', () => {
  const getGithubReleases = jest.spyOn(
    GithubReleasesDatasource.prototype,
    'getReleases',
  );

  const getGithubTags = jest.spyOn(
    GithubTagsDatasource.prototype,
    'getReleases',
  );

  const getDockerReleases = jest.spyOn(
    DockerDatasource.prototype,
    'getReleases',
  );

  const getMavenReleases = jest.spyOn(MavenDatasource.prototype, 'getReleases');
  const postprocessMavenRelease = jest.spyOn(
    MavenDatasource.prototype,
    'postprocessRelease',
  );

  const getCustomDatasourceReleases = jest.spyOn(
    CustomDatasource.prototype,
    'getReleases',
  );

  const getDockerDigest = jest.spyOn(DockerDatasource.prototype, 'getDigest');

  beforeEach(() => {
    // TODO: fix types #22198
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
    it('returns null if invalid currentValue', async () => {
      // @ts-expect-error: testing invalid currentValue
      config.currentValue = 3;

      const { skipReason } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(skipReason).toBe('invalid-value');
    });

    it('returns null if unknown datasource', async () => {
      config.packageName = 'some-dep';
      config.datasource = 'does not exist';

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('handles error result from getPkgReleasesWithResult', async () => {
      config.currentValue = '1.0.0';
      config.packageName = 'some-dep';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock.scope('https://registry.npmjs.org').get('/some-dep').reply(500);

      const res = await lookup.lookupUpdates(config);

      expect(() => res.unwrapOrThrow()).toThrow();
    });

    it('returns rollback for pinned version', async () => {
      config.currentValue = '0.9.99';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'rollback',
          newMajor: 0,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          registryUrl: undefined,
          updateType: 'rollback',
        },
        {
          bucket: 'major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('returns rollback for ranged version', async () => {
      config.currentValue = '^0.9.99';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.rollbackPrs = true;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'rollback',
          newMajor: 0,
          newValue: '^0.9.7',
          newVersion: '0.9.7',
          registryUrl: undefined,
          updateType: 'rollback',
        },
      ]);
    });

    it('supports minor and major upgrades for tilde ranges', async () => {
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 0,
          newValue: '0.4.4',
          newVersion: '0.4.4',
          updateType: 'pin',
        },
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '^0.9.0',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'patch',
          isLockfileUpdate: true,
          isRange: true,
          newMajor: 0,
          newMinor: 4,
          newPatch: 4,
          newValue: '^0.4.0',
          newVersion: '0.4.4',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2011-06-10T17:20:04.719Z',
          updateType: 'patch',
        },
        {
          bucket: 'minor',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '^0.9.0',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('returns multiple updates if grouping but separateMajorMinor=true', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('returns additional update if grouping but separateMinorPatch=true', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.separateMinorPatch = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'patch',
          newMajor: 0,
          newMinor: 4,
          newPatch: 4,
          newValue: '0.4.4',
          newVersion: '0.4.4',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
        {
          bucket: 'minor',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('returns one update if grouping and separateMajorMinor=false', async () => {
      config.groupName = 'somegroup';
      config.currentValue = '0.4.0';
      config.rangeStrategy = 'pin';
      config.separateMajorMinor = false;
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'latest',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('returns both updates if automerging minor', async () => {
      config.minor = { automerge: true };
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 0,
          newValue: '0.4.4',
          newVersion: '0.4.4',
          updateType: 'pin',
        },
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '^0.9.0',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('enforces allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('enforces allowedVersions with regex', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '/^0/';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
      ]);
    });

    it('enforces allowedVersions with negative regex', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '!/^1/';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
      ]);
    });

    it('falls back to semver syntax allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '<1';
      config.packageName = 'q';
      config.versioning = dockerVersioningId; // this doesn't make sense but works for this test
      config.datasource = NpmDatasource.id; // this doesn't make sense but works for this test
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
      ]);
    });

    it('falls back to pep440 syntax allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = '==0.9.4';
      config.packageName = 'q';
      config.versioning = poetryVersioningId; // this doesn't make sense but works for this test
      config.datasource = NpmDatasource.id; // this doesn't make sense but works for this test
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 4,
          newValue: '0.9.4',
          newVersion: '0.9.4',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-05-22T20:26:50.888Z',
          updateType: 'minor',
        },
      ]);
    });

    it('skips invalid allowedVersions', async () => {
      config.currentValue = '0.4.0';
      config.allowedVersions = 'less than 1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const res = await lookup.lookupUpdates(config);

      expect(() => res.unwrapOrThrow()).toThrow(Error(CONFIG_VALIDATION));
    });

    it('returns patch update even if separate patches not configured', async () => {
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
        {
          bucket: 'major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
        {
          bucket: 'major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('returns patch update if separateMinorPatch', async () => {
      config.separateMinorPatch = true;
      config.currentValue = '0.9.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'patch',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'patch',
        },
        {
          bucket: 'major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('returns patch minor and major', async () => {
      config.separateMinorPatch = true;
      config.currentValue = '0.8.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'patch',
          newMajor: 0,
          newMinor: 8,
          newPatch: 12,
          newValue: '0.8.12',
          newVersion: '0.8.12',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
        {
          bucket: 'minor',
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('disables major release separation (major)', async () => {
      config.separateMajorMinor = false;
      config.currentValue = '^0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 0,
          newValue: '0.4.4',
          newVersion: '0.4.4',
          updateType: 'pin',
        },
        {
          bucket: 'latest',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('disables major release separation (minor)', async () => {
      config.separateMajorMinor = false;
      config.currentValue = '1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'latest',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('uses minimum version for vulnerabilityAlerts', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 0,
          newPatch: 1,
          newValue: '1.0.1',
          newVersion: '1.0.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
    });

    it('uses highest available version for vulnerabilityAlerts when vulnerabilityFixStrategy=highest', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.vulnerabilityFixStrategy = 'highest';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('uses vulnerabilityFixVersion when a version', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.vulnerabilityFixVersion = '1.1.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 1,
          newPatch: 0,
          newValue: '1.1.0',
          newVersion: '1.1.0',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('takes a later release when vulnerabilityFixVersion does not exist', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.vulnerabilityFixVersion = '1.0.2';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 1,
          newPatch: 0,
          newValue: '1.1.0',
          newVersion: '1.1.0',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('uses vulnerabilityFixVersion when a range', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.vulnerabilityFixVersion = '>= 1.1.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 1,
          newPatch: 0,
          newValue: '1.1.0',
          newVersion: '1.1.0',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('takes highest available version when using vulnerabilityFixStrategy=highest with vulnerabilityFixVersion', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.vulnerabilityFixVersion = '1.1.0';
      config.vulnerabilityFixStrategy = 'highest';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('ignores vulnerabilityFixVersion if not a version', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.vulnerabilityFixVersion = 'abc';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 0,
          newPatch: 1,
          newValue: '1.0.1',
          newVersion: '1.0.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
    });

    it('returns no results if vulnerabilityFixVersion is too high', async () => {
      config.currentValue = '1.0.0';
      config.isVulnerabilityAlert = true;
      config.vulnerabilityFixVersion = '5.1.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('supports minor and major upgrades for ranged versions', async () => {
      config.currentValue = '~0.4.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 0,
          newValue: '0.4.4',
          newVersion: '0.4.4',
          updateType: 'pin',
        },
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '~0.9.0',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('supports for x-range-all for replaceStrategy = pin (with lockfile) abcd', async () => {
      config.currentValue = '*';
      config.rangeStrategy = 'pin';
      config.lockedVersion = '0.4.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 0,
          newValue: '0.4.0',
          newVersion: '0.4.0',
          updateType: 'pin',
        },
      ]);
    });

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

        const { updates } = await Result.wrap(
          lookup.lookupUpdates(config),
        ).unwrapOrThrow();

        expect(updates).toBeEmptyArray();
      },
    );

    it('supports pinning for x-range-all (no lockfile)', async () => {
      config.currentValue = '*';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          updateType: 'pin',
        },
      ]);
    });

    it('covers pinning an unsupported x-range-all value', async () => {
      config.currentValue = '';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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

        const { updates } = await Result.wrap(
          lookup.lookupUpdates(config),
        ).unwrapOrThrow();

        expect(updates).toBeEmptyArray();
      },
    );

    it('ignores pinning for ranges when other upgrade exists', async () => {
      config.currentValue = '~0.9.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 0,
          newValue: '0.9.7',
          newVersion: '0.9.7',
          updateType: 'pin',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades minor ranged versions', async () => {
      config.currentValue = '~1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 1,
          newValue: '1.0.1',
          newVersion: '1.0.1',
          updateType: 'pin',
        },
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('handles update-lockfile', async () => {
      config.currentValue = '^1.2.1';
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'update-lockfile';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isLockfileUpdate: true,
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.2.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('handles the in-range-only strategy and updates lockfile within range', async () => {
      config.currentValue = '^1.2.1';
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'in-range-only';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isLockfileUpdate: true,
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.2.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('handles the in-range-only strategy and discards changes not within range', async () => {
      config.currentValue = '~1.2.0';
      config.lockedVersion = '1.2.0';
      config.rangeStrategy = 'in-range-only';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isLockfileUpdate: true,
          isRange: true,
          newMajor: 1,
          newMinor: 2,
          newPatch: 1,
          newValue: '~1.2.0',
          newVersion: '1.2.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isLockfileUpdate: true,
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: undefined,
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('handles unconstrainedValue values with rangeStrategy !== update-lockfile and isVulnerabilityAlert', async () => {
      config.lockedVersion = '1.2.1';
      config.rangeStrategy = 'bump';
      config.packageName = 'q';
      config.isVulnerabilityAlert = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);
      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();
      expect(updates).toMatchObject([
        {
          bucket: 'non-major',
          isLockfileUpdate: true,
          isRange: true,
          newMajor: 1,
          newMinor: 3,
          newPatch: 0,
          newValue: undefined,
          newVersion: '1.3.0',
          releaseTimestamp: '2015-04-26T16:42:11.311Z',
          updateType: 'minor',
        },
      ]);
      expect(updates[0].newValue).toBeUndefined();
      expect(updates[0].updateType).toBe('minor');
    });

    it('widens minor ranged versions if configured', async () => {
      config.currentValue = '~1.3.0';
      config.rangeStrategy = 'widen';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.3.0 || ~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('replaces minor complex ranged versions if configured', async () => {
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.rangeStrategy = 'replace';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '^2.0.0 || ^3.0.0',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2017-10-17T15:22:36.646Z',
          updateType: 'major',
        },
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '^3.0.0',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2017-10-17T15:22:36.646Z',
          updateType: 'major',
        },
      ]);
    });

    it('pins minor ranged versions', async () => {
      config.currentValue = '^1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          updateType: 'pin',
        },
      ]);
    });

    it('uses the locked version for pinning', async () => {
      config.currentValue = '^1.0.0';
      config.lockedVersion = '1.0.0';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 1,
          newValue: '1.0.0',
          newVersion: '1.0.0',
          updateType: 'pin',
        },
      ]);
    });

    it('ignores minor ranged versions when not pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('ignores minor ranged versions when locked', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^1.0.0';
      config.lockedVersion = '1.1.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('upgrades tilde ranges', async () => {
      config.rangeStrategy = 'pin';
      config.currentValue = '~1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 1,
          newValue: '1.3.0',
          newVersion: '1.3.0',
          updateType: 'pin',
        },
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades .x minor ranges', async () => {
      config.currentValue = '1.3.x';
      config.rangeStrategy = 'pin';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 1,
          newValue: '1.3.0',
          newVersion: '1.3.0',
          updateType: 'pin',
        },
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.x',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades .x major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.x',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades .x minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.x',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades .x complex minor ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '1.2.x - 1.3.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.2.x - 1.4.x',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades shorthand major ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades shorthand minor ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '1.3';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades multiple tilde ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '~0.7.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '~0.9.0',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades multiple caret ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '^0.7.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '^0.9.0',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('supports complex ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '^0.7.0 || ^0.8.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '^0.7.0 || ^0.8.0 || ^0.9.0',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^0.7.0 || ^0.8.0 || ^1.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '^1.0.0 || ^2.0.0 || ^3.0.0',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2017-10-17T15:22:36.646Z',
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '1.x - 3.x',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2017-10-17T15:22:36.646Z',
          updateType: 'major',
        },
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '1.x || 2.x || 3.x',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2017-10-17T15:22:36.646Z',
          updateType: 'major',
        },
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '1 || 2 || 3',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2017-10-17T15:22:36.646Z',
          updateType: 'major',
        },
      ]);
    });

    it('supports complex tilde ranges', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '~1.2.0 || ~1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.2.0 || ~1.3.0 || ~1.4.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('returns nothing for greater than ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '>= 0.7.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toHaveLength(0);
    });

    it('upgrades less than equal ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 0.7.2';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '<= 0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '<= 1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 0.7.2';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '< 0.9.8',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2013-09-04T17:07:22.948Z',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '< 1.4.2',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades less than major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '< 2',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades less than equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.3';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '<= 1.4',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades equal minor ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '=1.3.1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '=1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades less than equal major ranges', async () => {
      config.rangeStrategy = 'replace';
      config.respectLatest = false;
      config.currentValue = '<= 1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 2,
          newMinor: 0,
          newPatch: 3,
          newValue: '<= 2',
          newVersion: '2.0.3',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-01-31T08:11:47.852Z',
          updateType: 'major',
        },
      ]);
    });

    it('upgrades major less than equal ranges', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '<= 1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '<= 1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
      ]);
    });

    it('upgrades major less than ranges without pinning', async () => {
      config.rangeStrategy = 'replace';
      config.currentValue = '< 1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '< 2.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('upgrades major greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 < 1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '>= 0.5.0 < 2.0.0',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('upgrades minor greater than less than ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 <0.8';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '>= 0.5.0 <0.10',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '>= 0.5.0 <1.5',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('upgrades minor greater than less than equals ranges without pinning', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '>= 0.5.0 <= 0.8.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 9,
          newPatch: 7,
          newValue: '>= 0.5.0 <= 0.9.7',
          newVersion: '0.9.7',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '>= 0.5.0 <= 1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('rejects reverse ordered less than greater than', async () => {
      config.rangeStrategy = 'widen';
      config.currentValue = '<= 0.8.0 >= 0.5.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('supports > latest versions if configured', async () => {
      config.respectLatest = false;
      config.currentValue = '1.4.1';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newMajor: 2,
          newMinor: 0,
          newPatch: 3,
          newValue: '2.0.3',
          newVersion: '2.0.3',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-01-31T08:11:47.852Z',
          updateType: 'major',
        },
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toHaveLength(0);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newMajor: 2,
          newMinor: 0,
          newPatch: 0,
          newValue: '2.0.0',
          newVersion: '2.0.0',
          updateType: 'major',
        },
      ]);
    });

    it('should allow unstable versions in same major for node', async () => {
      config.currentValue = '20.3.0';
      config.packageName = 'node';
      config.datasource = GithubTagsDatasource.id;
      config.versioning = nodeVersioningId;
      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: '20.3.0' },
          { version: '20.3.1' },
          { version: '21.0.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 20,
          newMinor: 3,
          newPatch: 1,
          newValue: '20.3.1',
          newVersion: '20.3.1',
          updateType: 'patch',
        },
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
          {
            version: '1.4.5',
            releaseTimestamp: lastWeek.toISOString(),
          },
          {
            version: '1.4.6',
            releaseTimestamp: yesterday.toISOString(),
          },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 6,
          newValue: '1.4.6',
          newVersion: '1.4.6',
          pendingChecks: true,
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
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
          {
            version: '1.4.5',
            releaseTimestamp: lastWeek.toISOString(),
          },
          {
            version: '1.4.6',
            releaseTimestamp: yesterday.toISOString(),
          },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 5,
          newValue: '1.4.5',
          newVersion: '1.4.5',
          pendingVersions: ['1.4.6'],
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 2,
          newMinor: 5,
          newPatch: 17,
          newValue: '2.5.17-beta.0',
          newVersion: '2.5.17-beta.0',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
    });

    it('should allow unstable versions if the current version is unstable', async () => {
      config.currentValue = '3.1.0-dev.20180731';
      config.packageName = 'typescript';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 3,
          newMinor: 1,
          newPatch: 0,
          newValue: '3.1.0-dev.20180813',
          newVersion: '3.1.0-dev.20180813',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
    });

    it('should not jump unstable versions', async () => {
      config.currentValue = '3.0.1-insiders.20180726';
      config.packageName = 'typescript';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/typescript')
        .reply(200, typescriptJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 3,
          newMinor: 0,
          newPatch: 1,
          newValue: '3.0.1',
          newVersion: '3.0.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 0,
          newMinor: 0,
          newPatch: 35,
          newValue: '0.0.35',
          newVersion: '0.0.35',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 3,
          newMinor: 0,
          newPatch: 1,
          newValue: '3.0.1-insiders.20180726',
          newVersion: '3.0.1-insiders.20180726',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'rollback',
          newMajor: 3,
          newValue: '3.0.1-insiders.20180726',
          newVersion: '3.0.1-insiders.20180726',
          registryUrl: undefined,
          updateType: 'rollback',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 3,
          newMinor: 0,
          newPatch: 1,
          newValue: '3.0.1-insiders.20180726',
          newVersion: '3.0.1-insiders.20180726',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'patch',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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

      const { updates, warnings } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
      expect(warnings).toEqual([
        {
          message: "Can't find version with tag foo for npm package typescript",
          topic: 'typescript',
        },
      ]);
    });

    it('should warn if no digest could be found but there is a current digest', async () => {
      config.currentValue = 'v1.0.0';
      config.currentDigest = 'bla';
      config.digestOneAndOnly = true;
      config.packageName = 'angular/angular';
      config.datasource = GithubTagsDatasource.id;

      // Only mock calls once so that the second invocation results in
      // no digest being computable.
      getGithubReleases.mockResolvedValueOnce({ releases: [] });
      getGithubTags.mockResolvedValueOnce({
        releases: [
          {
            version: 'v2.0.0',
            gitRef: 'v2.0.0',
            releaseTimestamp: '2022-01-01',
          },
        ],
      });

      const { updates, warnings } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
      expect(warnings).toEqual([
        {
          message:
            'Could not determine new digest for update (github-tags package angular/angular)',
          topic: 'angular/angular',
        },
      ]);
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
        getGithubReleases.mockResolvedValueOnce({ releases: [] });
        getGithubTags.mockResolvedValueOnce({
          releases: [
            {
              version: 'v2.0.0',
              gitRef: 'v2.0.0',
              releaseTimestamp: '2022-01-01',
            },
          ],
        });

        const { updates, warnings } = await Result.wrap(
          lookup.lookupUpdates(config),
        ).unwrapOrThrow();

        expect(updates).toBeEmptyArray();
        expect(warnings).toBeEmptyArray();
      });
    });

    it('should use registry of update to determine digest', async () => {
      config.currentValue = 'v1.0.0';
      config.registryUrls = [
        'https://github.enterprise.com',
        'https://github.com',
      ];
      config.digestOneAndOnly = true;
      config.packageName = 'angular/angular';
      config.pinDigests = true;
      config.datasource = GithubTagsDatasource.id;

      getGithubTags.mockRejectedValueOnce(
        new Error('Not contained in registry'),
      );
      getGithubTags.mockResolvedValueOnce({
        releases: [
          {
            version: 'v1.0.0',
            gitRef: 'v1.0.0',
            releaseTimestamp: '2022-01-01',
          },
        ],
      });
      const getGithubTagsDigest = jest
        .spyOn(GithubTagsDatasource.prototype, 'getDigest')
        .mockResolvedValueOnce('digest1234');

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPinDigest: true,
          newDigest: 'digest1234',
          newValue: 'v1.0.0',
          updateType: 'pinDigest',
        },
      ]);
      expect(getGithubTagsDigest).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ registryUrl: 'https://github.com' }),
        'v1.0.0',
      );
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isRange: true,
          newMajor: 0,
          newMinor: 0,
          newPatch: 35,
          newValue: '^0.0.35',
          newVersion: '0.0.35',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2017-04-27T16:59:06.479Z',
          updateType: 'patch',
        },
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'rollback',
          newMajor: 1,
          newValue: '1.16.0',
          newVersion: '1.16.0',
          registryUrl: undefined,
          updateType: 'rollback',
        },
      ]);
    });

    it('should upgrade to only one major', async () => {
      config.currentValue = '1.0.0';
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 15,
          newPatch: 0,
          newValue: '1.15.0',
          newVersion: '1.15.0',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'major',
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '3.8.1',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 15,
          newPatch: 0,
          newValue: '1.15.0',
          newVersion: '1.15.0',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'minor',
        },
        {
          bucket: 'v2',
          newMajor: 2,
          newMinor: 7,
          newPatch: 0,
          newValue: '2.7.0',
          newVersion: '2.7.0',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
        {
          bucket: 'v3',
          newMajor: 3,
          newMinor: 8,
          newPatch: 1,
          newValue: '3.8.1',
          newVersion: '3.8.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: expect.any(String),
          updateType: 'major',
        },
      ]);
    });

    it('should upgrade to 16 minors', async () => {
      config.currentValue = '1.0.0';
      config.separateMultipleMinor = true;
      config.packageName = 'webpack';
      config.datasource = NpmDatasource.id;
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/webpack')
        .reply(200, webpackJson);
      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();
      expect(updates).toHaveLength(16);
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('supports in-range caret updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '^1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isBump: true,
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '^1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('supports in-range tilde updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.packageName = 'q';
      config.separateMinorPatch = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'patch',
          isBump: true,
          isRange: true,
          newMajor: 1,
          newMinor: 0,
          newPatch: 1,
          newValue: '~1.0.1',
          newVersion: '1.0.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2014-03-11T18:47:17.560Z',
          updateType: 'patch',
        },
        {
          bucket: 'minor',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('supports in-range tilde patch updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '~1.0.0';
      config.packageName = 'q';
      config.separateMinorPatch = true;
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'patch',
          isBump: true,
          isRange: true,
          newMajor: 1,
          newMinor: 0,
          newPatch: 1,
          newValue: '~1.0.1',
          newVersion: '1.0.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2014-03-11T18:47:17.560Z',
          updateType: 'patch',
        },
        {
          bucket: 'minor',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('supports in-range gte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          isBump: true,
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '>=1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('supports majorgte updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>=0.9.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.separateMajorMinor = false;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'latest',
          isBump: true,
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '>=1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('rejects in-range unsupported operator', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '>1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('rejects non-fully specified in-range updates', async () => {
      config.rangeStrategy = 'update-lockfile';
      config.currentValue = '1.x';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('rejects complex range in-range updates', async () => {
      config.rangeStrategy = 'bump';
      config.currentValue = '^0.9.0 || ^1.0.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('replaces non-range in-range updates', async () => {
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.packageFile = 'package.json';
      config.rangeStrategy = 'bump';
      config.currentValue = '1.0.0';
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '1.4.1',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'minor',
        },
      ]);
    });

    it('handles github 404', async () => {
      config.packageName = 'foo';
      config.datasource = GithubTagsDatasource.id;
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';
      httpMock.scope('https://pypi.org').get('/pypi/foo/json').reply(404);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('handles unknown datasource', async () => {
      config.packageName = 'foo';
      config.datasource = 'typo';
      config.packageFile = 'package.json';
      config.currentValue = '1.0.0';

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          isPin: true,
          newMajor: 0,
          newValue: '==0.9.4',
          newVersion: '0.9.4',
          updateType: 'pin',
        },
        {
          bucket: 'major',
          isRange: true,
          newMajor: 1,
          newMinor: 4,
          newPatch: 1,
          newValue: '~=1.4',
          newVersion: '1.4.1',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2015-05-17T04:25:07.299Z',
          updateType: 'major',
        },
      ]);
    });

    it('returns complex object', async () => {
      config.currentValue = '1.3.0';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toMatchObject({
        currentVersion: '1.3.0',
        currentVersionTimestamp: '2015-04-26T16:42:11.311Z',
        fixedVersion: '1.3.0',
        isSingleVersion: true,
        registryUrl: 'https://registry.npmjs.org',
        sourceUrl: 'https://github.com/kriskowal/q',
        updates: [
          {
            bucket: 'non-major',
            newMajor: 1,
            newMinor: 4,
            newPatch: 1,
            newValue: '1.4.1',
            newVersion: '1.4.1',
            newVersionAgeInDays: expect.any(Number),
            releaseTimestamp: expect.any(String),
            updateType: 'minor',
          },
        ],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('ignores deprecated when it is not the latest', async () => {
      config.currentValue = '1.3.0';
      config.packageName = 'q2';
      config.datasource = NpmDatasource.id;
      const returnJson = JSON.parse(JSON.stringify(qJson));
      returnJson.name = 'q2';
      // mark latest minor as deprecated
      returnJson.versions['1.4.1'].deprecated = 'true';
      // make sure latest release isn't the one deprecated as otherwise every release is deprecated
      returnJson['dist-tags'].latest = '2.0.3';
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/q2')
        .reply(200, returnJson);

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();
      expect(res).toMatchObject({
        currentVersion: '1.3.0',
        currentVersionTimestamp: '2015-04-26T16:42:11.311Z',
        fixedVersion: '1.3.0',
        isSingleVersion: true,
        registryUrl: 'https://registry.npmjs.org',
        sourceUrl: 'https://github.com/kriskowal/q',
        updates: [
          {
            bucket: 'non-major',
            newMajor: 1,
            newMinor: 4,
            newPatch: 0,
            newValue: '1.4.0',
            newVersion: '1.4.0',
            newVersionAgeInDays: expect.any(Number),
            releaseTimestamp: expect.any(String),
            updateType: 'minor',
          },
          {
            bucket: 'major',
            newMajor: 2,
            newMinor: 0,
            newPatch: 3,
            newValue: '2.0.3',
            newVersion: '2.0.3',
            newVersionAgeInDays: expect.any(Number),
            releaseTimestamp: expect.any(String),
            updateType: 'major',
          },
        ],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('treats all versions as deprecated if latest is deprecated', async () => {
      config.currentValue = '1.3.0';
      config.packageName = 'q3';
      config.datasource = NpmDatasource.id;
      const returnJson = {
        ...JSON.parse(JSON.stringify(qJson)),
        name: 'q3',
        deprecated: true,
        repository: { url: null, directory: 'test' },
      };
      returnJson.versions['1.4.1'].deprecated = 'true';

      httpMock
        .scope('https://registry.npmjs.org')
        .get('/q3')
        .reply(200, returnJson);

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toMatchObject({
        currentVersion: '1.3.0',
        currentVersionTimestamp: '2015-04-26T16:42:11.311Z',
        deprecationMessage: codeBlock`
        On registry \`https://registry.npmjs.org\`, the "latest" version of dependency \`q3\` has the following deprecation notice:

        \`true\`

        Marking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.
      `,
        fixedVersion: '1.3.0',
        isSingleVersion: true,
        registryUrl: 'https://registry.npmjs.org',
        sourceDirectory: 'test',
        sourceUrl: 'https://github.com/kriskowal/q',
        updates: [
          {
            bucket: 'non-major',
            newMajor: 1,
            newMinor: 4,
            newPatch: 1,
            newValue: '1.4.1',
            newVersion: '1.4.1',
            newVersionAgeInDays: expect.any(Number),
            releaseTimestamp: expect.any(String),
            updateType: 'minor',
          },
        ],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('skips unsupported values', async () => {
      config.currentValue = 'alpine';
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        skipReason: 'invalid-value',
        updates: [],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('skips undefined values', async () => {
      config.packageName = 'node';
      config.datasource = DockerDatasource.id;

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        skipReason: 'invalid-value',
        updates: [],
        versioning: 'npm',
        warnings: [],
      });
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

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '8.0.0',
        fixedVersion: '8.0.0',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [
          {
            bucket: 'non-major',
            newDigest: 'sha256:abcdef1234567890',
            newMajor: 8,
            newMinor: 1,
            newPatch: 0,
            newValue: '8.1.0',
            newVersion: '8.1.0',
            updateType: 'minor',
          },
          {
            isPinDigest: true,
            newDigest: 'sha256:0123456789abcdef',
            newValue: '8.0.0',
            updateType: 'pinDigest',
          },
        ],
        versioning: 'npm',
        warnings: [],
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
          { version: '8.2.5', newDigest: 'abc123' },
          { version: '8.2' },
          { version: '8' },
          { version: '9.0' },
          { version: '9' },
        ],
      });

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '8.1.0',
        fixedVersion: '8.1.0',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [
          {
            bucket: 'non-major',
            newMajor: 8,
            newMinor: 2,
            newPatch: 5,
            newValue: '8.2.5',
            newVersion: '8.2.5',
            updateType: 'minor',
          },
        ],
        versioning: 'docker',
        warnings: [],
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

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '8.1',
        fixedVersion: '8.1',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [
          {
            bucket: 'non-major',
            newMajor: 8,
            newMinor: 2,
            newPatch: null,
            newValue: '8.2',
            newVersion: '8.2',
            updateType: 'minor',
          },
          {
            bucket: 'major',
            newMajor: 9,
            newMinor: 0,
            newPatch: null,
            newValue: '9.0',
            newVersion: '9.0',
            registryUrl: 'https://other.registry',
            updateType: 'major',
          },
        ],
        versioning: 'docker',
        warnings: [],
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

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '8',
        fixedVersion: '8',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [
          {
            bucket: 'major',
            newMajor: 9,
            newMinor: null,
            newPatch: null,
            newValue: '9',
            newVersion: '9',
            updateType: 'major',
          },
        ],
        versioning: 'docker',
        warnings: [],
      });
    });

    it('applies versionCompatibility for 18.10.0', async () => {
      config.currentValue = '18.10.0-alpine';
      config.currentDigest = 'aaa111';
      config.packageName = 'node';
      config.versioning = nodeVersioningId;
      config.versionCompatibility = '^(?<version>[^-]+)(?<compatibility>-.*)?$';
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          { version: '18.10.0' },
          { version: '18.18.0' },
          { version: '18.19.0-alpine' },
          { version: '18.20.0' },
        ],
      });
      getDockerDigest.mockResolvedValueOnce('bbb222');
      getDockerDigest.mockResolvedValueOnce('ccc333');

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(getDockerDigest.mock.calls).toEqual([
        [
          {
            currentDigest: 'aaa111',
            currentValue: '18.10.0-alpine',
            packageName: 'node',
            registryUrl: 'https://index.docker.io',
          },
          '18.19.0-alpine',
        ],
        [
          {
            currentDigest: 'aaa111',
            currentValue: '18.10.0-alpine',
            packageName: 'node',
            registryUrl: 'https://index.docker.io',
          },
          '18.10.0-alpine',
        ],
      ]);

      expect(res).toEqual({
        currentVersion: '18.10.0',
        fixedVersion: '18.10.0',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [
          {
            bucket: 'non-major',
            newDigest: 'bbb222',
            newMajor: 18,
            newMinor: 19,
            newPatch: 0,
            newValue: '18.19.0-alpine',
            newVersion: '18.19.0',
            updateType: 'minor',
          },
          {
            newDigest: 'ccc333',
            newValue: '18.10.0-alpine',
            updateType: 'digest',
          },
        ],
        versioning: 'node',
        warnings: [],
      });
    });

    it('applies versionCompatibility for maven', async () => {
      config.currentValue = '12.4.2.jre8';
      config.packageName = 'com.microsoft.sqlserver:mssql-jdbc';
      config.versioning = mavenVersioningId;
      config.versionCompatibility =
        '^(?<version>.*)(?<compatibility>\\.jre.*)$';
      config.datasource = MavenDatasource.id;
      getMavenReleases.mockResolvedValueOnce({
        releases: [
          { version: '12.4.2.jre8' },
          { version: '12.5.0.jre11' },
          { version: '12.6.1.jre8' },
          { version: '12.6.1.jre11' },
          { version: '12.6.2.jre11' },
        ],
      });
      postprocessMavenRelease.mockImplementationOnce((_, x) =>
        Promise.resolve(x),
      );

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toMatchObject({
        currentVersion: '12.4.2',
        updates: [
          {
            bucket: 'non-major',
            newValue: '12.6.1.jre8',
            newVersion: '12.6.1',
            updateType: 'minor',
          },
        ],
        versioning: 'maven',
        warnings: [],
      });
    });

    it('handles versionCompatibility mismatch', async () => {
      config.currentValue = '18.10.0-alpine';
      config.packageName = 'node';
      config.versioning = nodeVersioningId;
      config.versionCompatibility = '^(?<version>[^-]+)-slim$';
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          { version: '18.18.0' },
          { version: '18.19.0-alpine' },
          { version: '18.20.0' },
        ],
      });

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [],
        versioning: 'node',
        warnings: [],
      });
    });

    it('applies versionCompatibility for debian codenames with suffix', async () => {
      config.currentValue = 'bullseye-slim';
      config.packageName = 'debian';
      config.versioning = debianVersioningId;
      config.versionCompatibility = '^(?<version>[^-]+)(?<compatibility>-.*)?$';
      config.datasource = DockerDatasource.id;
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          { version: 'bullseye' },
          { version: 'bullseye-slim' },
          { version: 'bookworm' },
          { version: 'bookworm-slim' },
        ],
      });

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: 'bullseye',
        fixedVersion: 'bullseye',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        updates: [
          {
            bucket: 'major',
            newMajor: 12,
            newMinor: null,
            newPatch: null,
            newValue: 'bookworm-slim',
            newVersion: 'bookworm',
            updateType: 'major',
          },
        ],
        versioning: 'debian',
        warnings: [],
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

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '8.1.0',
        fixedVersion: '8.1.0',
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [
          {
            isPinDigest: true,
            newDigest: 'sha256:abcdef1234567890',
            newValue: '8.1.0',
            updateType: 'pinDigest',
          },
        ],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('handles no fitting version and no version in lock file', async () => {
      config.currentValue = '~9.5.0';
      config.packageName = 'typo3/cms-saltedpasswords';
      config.datasource = DockerDatasource.id;
      config.versioning = composerVersioningId;
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

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        registryUrl: 'https://index.docker.io',
        skipReason: 'invalid-value',
        updates: [],
        versioning: 'composer',
        warnings: [],
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

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        updates: [
          {
            isPinDigest: true,
            newDigest: 'sha256:abcdef1234567890',
            newValue: 'alpine',
            updateType: 'pinDigest',
          },
        ],
        versioning: 'npm',
        warnings: [],
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
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
            newDigest: 'sha256:0123456789abcdef',
          },
          {
            version: '8.1.0',
          },
        ],
      });
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '8.0.0',
        fixedVersion: '8.0.0',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        sourceUrl: 'https://github.com/nodejs/node',
        updates: [
          {
            bucket: 'non-major',
            newDigest: 'sha256:abcdef1234567890',
            newMajor: 8,
            newMinor: 1,
            newPatch: 0,
            newValue: '8.1.0',
            newVersion: '8.1.0',
            updateType: 'minor',
          },
          {
            newDigest: 'sha256:0123456789abcdef',
            newValue: '8.0.0',
            updateType: 'digest',
          },
        ],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('handles digest update for custom datasource', async () => {
      config.currentValue = '1.0.0';
      config.packageName = 'my-package';
      config.datasource = CustomDatasource.id;
      config.currentDigest = 'zzzzzzzzzzzzzzz';
      getCustomDatasourceReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '1.0.0',
            newDigest: '0123456789abcdef',
          },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          newDigest: '0123456789abcdef',
          newValue: '1.0.0',
          updateType: 'digest',
        },
      ]);
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

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        updates: [
          {
            newDigest: 'sha256:abcdef1234567890',
            newValue: 'alpine',
            updateType: 'digest',
          },
        ],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('handles git submodule update', async () => {
      config.packageName = 'some-path';
      config.versioning = gitVersioningId;
      config.datasource = GitRefsDatasource.id;
      config.currentDigest = 'some-digest';

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        updates: [
          {
            newDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            newValue: undefined,
            updateType: 'digest',
          },
        ],
        versioning: 'git',
        warnings: [],
      });
    });

    it('handles sourceUrl packageRules with version restrictions', async () => {
      config.currentValue = '0.9.99';
      config.packageName = 'q';
      config.datasource = NpmDatasource.id;
      config.packageRules = [
        {
          matchSourceUrls: ['https://github.com/kriskowal/**'],
          allowedVersions: '< 1.4.0',
        },
      ];
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '0.9.99',
        fixedVersion: '0.9.99',
        isSingleVersion: true,
        registryUrl: 'https://registry.npmjs.org',
        sourceUrl: 'https://github.com/kriskowal/q',
        updates: [
          {
            bucket: 'major',
            newMajor: 1,
            newMinor: 3,
            newPatch: 0,
            newValue: '1.3.0',
            newVersion: '1.3.0',
            newVersionAgeInDays: expect.any(Number),
            releaseTimestamp: expect.any(String),
            updateType: 'major',
          },
        ],
        versioning: 'npm',
        warnings: [],
      });
    });

    it('handles current age packageRules with version restrictions', async () => {
      config.packageName = 'openjdk';
      config.currentValue = '17.0.0';
      config.datasource = DockerDatasource.id;
      config.versioning = dockerVersioningId;
      // This config is normally set when packageRules are applied
      config.packageRules = [
        {
          matchCurrentAge: '> 1 day',
          allowedVersions: '< 19.0.0',
        },
      ];
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
            // a day old release
            releaseTimestamp: new Date(
              Date.now() - 25 * 60 * 60 * 1000,
            ).toISOString(),
          },
          {
            version: '18.0.0',
          },
          {
            version: '19.0.0',
          },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newMajor: 18,
          newMinor: 0,
          newPatch: 0,
          newValue: '18.0.0',
          newVersion: '18.0.0',
          updateType: 'major',
        },
      ]);
    });

    it('does not apply package rules for matchCurrentAge if packageRules doesn not have a current age matcher', async () => {
      config.packageName = 'openjdk';
      config.currentValue = '17.0.0';
      config.datasource = DockerDatasource.id;
      config.versioning = dockerVersioningId;
      // This config is normally set when packageRules are applied
      config.packageRules = [
        {
          matchDepNames: ['openjdk'],
          allowedVersions: '< 19.0.0',
        },
      ];
      const releaseTimestamp = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
            // a day old release
            releaseTimestamp,
          },
          {
            version: '18.0.0',
          },
          {
            version: '19.0.0',
          },
        ],
      });

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '17.0.0',
        currentVersionAgeInDays: 1,
        currentVersionTimestamp: releaseTimestamp,
        fixedVersion: '17.0.0',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        updates: [
          {
            bucket: 'major',
            newMajor: 19,
            newMinor: 0,
            newPatch: 0,
            newValue: '19.0.0',
            newVersion: '19.0.0',
            updateType: 'major',
          },
        ],
        versioning: 'docker',
        warnings: [],
      });
    });

    it('does not apply package rules for matchCurrentAge if the releaseTimestamp for current version is missing', async () => {
      config.packageName = 'openjdk';
      config.currentValue = '17.0.0';
      config.datasource = DockerDatasource.id;
      config.versioning = dockerVersioningId;
      // This config is normally set when packageRules are applied
      config.packageRules = [
        {
          matchCurrentAge: '> 1 day',
          allowedVersions: '< 19.0.0',
        },
      ];
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
          },
          {
            version: '18.0.0',
          },
          {
            version: '19.0.0',
          },
        ],
      });

      const res = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(res).toEqual({
        currentVersion: '17.0.0',
        fixedVersion: '17.0.0',
        isSingleVersion: true,
        registryUrl: 'https://index.docker.io',
        updates: [
          {
            bucket: 'major',
            newMajor: 19,
            newMinor: 0,
            newPatch: 0,
            newValue: '19.0.0',
            newVersion: '19.0.0',
            updateType: 'major',
          },
        ],
        versioning: 'docker',
        warnings: [],
        currentVersionTimestamp: undefined,
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newMajor: 18,
          newMinor: 0,
          newPatch: 0,
          newValue: '18.0.0',
          newVersion: '18.0.0',
          updateType: 'major',
        },
        {
          newName: 'eclipse-temurin',
          newValue: '17.0.0',
          newVersion: undefined,
          updateType: 'replacement',
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newDigest: 'sha256:abcdef1234567890',
          newMajor: 18,
          newMinor: 0,
          newPatch: 0,
          newValue: '18.0.0',
          newVersion: '18.0.0',
          updateType: 'major',
        },
        {
          newDigest: 'sha256:0123456789abcdef',
          newName: 'eclipse-temurin',
          newValue: '17.0.0',
          newVersion: undefined,
          updateType: 'replacement',
        },
        {
          isPinDigest: true,
          newDigest: 'sha256:pin0987654321',
          newValue: '17.0.0',
          newVersion: undefined,
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          updateType: 'replacement',
          newName: 'eclipse-temurin',
          newValue: undefined,
        },
      ]);
    });

    it('handles replacements - Digest configured and validating getDigest funtion call', async () => {
      config.packageName = 'openjdk';
      config.currentDigest = 'sha256:fedcba0987654321';
      config.currentValue = '17.0.0';
      //config.pinDigests = true;
      config.datasource = DockerDatasource.id;
      config.versioning = dockerVersioningId;
      // This config is normally set when packageRules are applied
      config.replacementName = 'eclipse-temurin';
      config.replacementVersion = '19.0.0';
      getDockerReleases.mockResolvedValueOnce({
        releases: [
          {
            version: '17.0.0',
          },
          {
            version: '17.0.1',
          },
        ],
        lookupName: 'openjdk',
      });
      getDockerDigest.mockResolvedValueOnce('sha256:abcdef1234567890');
      getDockerDigest.mockResolvedValueOnce('sha256:fedcba0987654321');
      getDockerDigest.mockResolvedValueOnce('sha256:pin0987654321');

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newDigest: 'sha256:abcdef1234567890',
          newMajor: 17,
          newMinor: 0,
          newPatch: 1,
          newValue: '17.0.1',
          newVersion: '17.0.1',
          updateType: 'patch',
        },
        {
          newDigest: 'sha256:fedcba0987654321',
          newName: 'eclipse-temurin',
          newValue: '19.0.0',
          newVersion: undefined,
          updateType: 'replacement',
        },
        {
          newDigest: 'sha256:pin0987654321',
          newValue: '17.0.0',
          newVersion: undefined,
          updateType: 'digest',
        },
      ]);

      expect(getDockerDigest).toHaveBeenNthCalledWith(
        1,
        {
          currentDigest: 'sha256:fedcba0987654321',
          currentValue: '17.0.0',
          lookupName: 'openjdk',
          packageName: 'openjdk',
          registryUrl: 'https://index.docker.io',
        },
        '17.0.1',
      );
      expect(getDockerDigest).toHaveBeenNthCalledWith(
        2,
        {
          currentDigest: undefined,
          currentValue: '17.0.0',
          lookupName: undefined,
          packageName: 'eclipse-temurin',
          registryUrl: 'https://index.docker.io',
        },
        '19.0.0',
      );
      expect(getDockerDigest).toHaveBeenNthCalledWith(
        3,
        {
          currentDigest: 'sha256:fedcba0987654321',
          currentValue: '17.0.0',
          lookupName: 'openjdk',
          packageName: 'openjdk',
          registryUrl: 'https://index.docker.io',
        },
        '17.0.0',
      );
    });

    it('handles replacements - skips if package and replacement names match', async () => {
      config.packageName = 'openjdk';
      config.currentValue = undefined;
      config.datasource = DockerDatasource.id;
      config.replacementName = 'openjdk';

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toBeEmptyArray();
    });

    it('handles replacements - name and version', async () => {
      config.currentValue = '1.4.1';
      config.packageName = 'q';
      // This config is normally set when packageRules are applied
      config.replacementName = 'r';
      config.replacementVersion = '2.0.0';
      config.datasource = NpmDatasource.id;
      httpMock.scope('https://registry.npmjs.org').get('/q').reply(200, qJson);

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newMajor: 18,
          newMinor: 0,
          newPatch: 0,
          newValue: '18.0.0',
          newVersion: '18.0.0',
          updateType: 'major',
        },
        {
          newName: 'new.registry.io/library/openjdk',
          newValue: '17.0.0',
          updateType: 'replacement',
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newMajor: 18,
          newMinor: 0,
          newPatch: 0,
          newValue: '18.0.0',
          newVersion: '18.0.0',
          updateType: 'major',
        },
        {
          newName: 'new.registry.io/library/openjdk',
          newValue: '18.0.0',
          updateType: 'replacement',
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          newMajor: 18,
          newMinor: 0,
          newPatch: 0,
          newValue: '18.0.0',
          newVersion: '18.0.0',
          updateType: 'major',
        },
        {
          newName: 'eclipse-temurin',
          newValue: '17.0.0',
          updateType: 'replacement',
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          updateType: 'replacement',
          newName: 'eclipse-temurin',
          newValue: '17.0.0-jre-alpine',
        },
      ]);
    });

    it('handles replacements - from datasource', async () => {
      config.currentValue = '2.0.0';
      config.packageName = 'org.example:foo';
      config.datasource = MavenDatasource.id;
      getMavenReleases.mockResolvedValueOnce({
        releases: [{ version: '2.0.0' }],
        replacementName: 'foo:bar',
        replacementVersion: '2.0.0',
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          updateType: 'replacement',
          newName: 'foo:bar',
          newValue: '2.0.0',
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

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
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
      const mcConfig: AllConfig = {
        mergeConfidenceEndpoint: defaultApiBaseUrl,
        mergeConfidenceDatasources: presetSupportedDatasources,
      };
      const getMergeConfidenceSpy = jest.spyOn(
        McApi,
        'getMergeConfidenceLevel',
      );
      const hostRule: HostRule = {
        hostType: 'merge-confidence',
        token: 'some-token',
      };

      beforeEach(() => {
        hostRules.add(hostRule);
        initConfig(mcConfig);
        memCache.reset();
      });

      afterEach(() => {
        resetConfig();
      });

      it('gets a merge confidence level for a given update when corresponding packageRule is in use', async () => {
        getMergeConfidenceSpy.mockRestore();
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
            `/api/mc/json/${datasource}/${packageName}/${currentValue}/${newVersion}`,
          )
          .reply(200, { confidence: 'high' });

        const { updates } = await Result.wrap(
          lookup.lookupUpdates(config),
        ).unwrapOrThrow();

        expect(updates).toEqual([
          {
            bucket: 'non-major',
            mergeConfidenceLevel: 'high',
            newMajor: 3,
            newMinor: 8,
            newPatch: 1,
            newValue: '3.8.1',
            newVersion: '3.8.1',
            newVersionAgeInDays: expect.any(Number),
            releaseTimestamp: '2017-10-17T15:22:36.646Z',
            updateType: 'minor',
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

        const { updates } = await Result.wrap(
          lookup.lookupUpdates(config),
        ).unwrapOrThrow();

        expect(getMergeConfidenceSpy).toHaveBeenCalledTimes(0);
        expect(updates).toEqual([
          {
            bucket: 'non-major',
            newMajor: 3,
            newMinor: 8,
            newPatch: 1,
            newValue: '3.8.1',
            newVersion: '3.8.1',
            newVersionAgeInDays: expect.any(Number),
            releaseTimestamp: '2017-10-17T15:22:36.646Z',
            updateType: 'minor',
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
        initConfig(mcConfig);
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/webpack')
          .reply(200, webpackJson);

        const { updates } = await Result.wrap(
          lookup.lookupUpdates(config),
        ).unwrapOrThrow();

        expect(updates).toBeEmptyArray();
      });
    });

    it('detects gomod updates and uses updateType=digest when appropriate', async () => {
      config.manager = 'gomod';
      config.datasource = GoDatasource.id;
      config.currentValue = 'v0.0.0-20240506185236-b8a5c65736ae';
      config.currentDigest = 'b8a5c65736ae';
      config.packageName = 'google.golang.org/genproto/googleapis/rpc';
      config.digestOneAndOnly = true;

      httpMock
        .scope(
          'https://proxy.golang.org/google.golang.org/genproto/googleapis/rpc',
        )
        .get('/@v/list')
        .reply(200, '')
        .get('/v2/@v/list')
        .reply(404)
        .get('/@latest')
        .reply(200, { Version: 'v0.0.0-20240509183442-62759503f434' });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(config),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          newDigest: '62759503f434',
          newMajor: 0,
          newMinor: 0,
          newPatch: 0,
          newValue: 'v0.0.0-20240509183442-62759503f434',
          newVersion: 'v0.0.0-20240509183442-62759503f434',
          newVersionAgeInDays: expect.any(Number),
          releaseTimestamp: '2024-05-09T18:34:42.000Z',
          updateType: 'digest',
        },
      ]);
    });
  });
});
