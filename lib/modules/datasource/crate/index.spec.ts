import { setTimeout } from 'timers/promises';
import fs from 'fs-extra';
import _simpleGit, { SimpleGit } from 'simple-git';
import { DirectoryResult, dir } from 'tmp-promise';
import { dirname, join } from 'upath';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as memCache from '../../../util/cache/memory';
import type { RegistryInfo } from './types';
import { CrateDatasource } from '.';

jest.mock('simple-git');
const simpleGit: jest.Mock<Partial<SimpleGit>> = _simpleGit as never;

const API_BASE_URL = CrateDatasource.CRATES_IO_API_BASE_URL;

const baseUrl =
  'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

const datasource = CrateDatasource.id;

function setupGitMocks(delayMs?: number): { mockClone: jest.Mock<any, any> } {
  const mockClone = jest
    .fn()
    .mockName('clone')
    .mockImplementation(
      async (_registryUrl: string, clonePath: string, _opts) => {
        if (delayMs && delayMs > 0) {
          await setTimeout(delayMs);
        }

        const path = `${clonePath}/my/pk/mypkg`;
        fs.mkdirSync(dirname(path), { recursive: true });
        fs.writeFileSync(path, Fixtures.get('mypkg'), { encoding: 'utf8' });
      },
    );

  simpleGit.mockReturnValue({
    clone: mockClone,
  });

  return { mockClone };
}

function setupErrorGitMock(): { mockClone: jest.Mock<any, any> } {
  const mockClone = jest
    .fn()
    .mockName('clone')
    .mockImplementation((_registryUrl: string, _clonePath: string, _opts) =>
      Promise.reject(new Error('mocked error')),
    );

  simpleGit.mockReturnValue({
    clone: mockClone,
  });

  return { mockClone };
}

function mockCratesApiCallFor(crateName: string, response?: httpMock.Body) {
  httpMock
    .scope(API_BASE_URL)
    .get(`/crates/${crateName}?include=`)
    .reply(response ? 200 : 404, response);
}

describe('modules/datasource/crate/index', () => {
  describe('getIndexSuffix', () => {
    it('returns correct suffixes', () => {
      expect(CrateDatasource.getIndexSuffix('a')).toStrictEqual(['1', 'a']);
      expect(CrateDatasource.getIndexSuffix('1')).toStrictEqual(['1', '1']);
      expect(CrateDatasource.getIndexSuffix('1234567')).toStrictEqual([
        '12',
        '34',
        '1234567',
      ]);
      expect(CrateDatasource.getIndexSuffix('ab')).toStrictEqual(['2', 'ab']);
      expect(CrateDatasource.getIndexSuffix('abc')).toStrictEqual([
        '3',
        'a',
        'abc',
      ]);
      expect(CrateDatasource.getIndexSuffix('abcd')).toStrictEqual([
        'ab',
        'cd',
        'abcd',
      ]);
      expect(CrateDatasource.getIndexSuffix('abcde')).toStrictEqual([
        'ab',
        'cd',
        'abcde',
      ]);
    });
  });

  describe('getReleases', () => {
    let tmpDir: DirectoryResult | null;
    let adminConfig: RepoGlobalConfig;

    beforeEach(async () => {
      tmpDir = await dir({ unsafeCleanup: true });

      adminConfig = {
        localDir: join(tmpDir.path, 'local'),
        cacheDir: join(tmpDir.path, 'cache'),
      };
      GlobalConfig.set(adminConfig);

      simpleGit.mockReset();
      memCache.init();
    });

    afterEach(async () => {
      await tmpDir?.cleanup();
      tmpDir = null;
      GlobalConfig.reset();
    });

    it('returns null for missing registry url', async () => {
      // FIXME: should not call default registry?
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(404, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'non_existent_crate',
          registryUrls: [],
        }),
      ).toBeNull();
    });

    it('returns null for invalid registry url', async () => {
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'non_existent_crate',
          registryUrls: ['3'],
        }),
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      mockCratesApiCallFor('non_existent_crate');
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'non_existent_crate',
          registryUrls: ['https://crates.io'],
        }),
      ).toBeNull();
    });

    it('returns null for missing fields', async () => {
      mockCratesApiCallFor('non_existent_crate');
      httpMock
        .scope(baseUrl)
        .get('/no/n_/non_existent_crate')
        .reply(200, undefined);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'non_existent_crate',
          registryUrls: ['https://crates.io'],
        }),
      ).toBeNull();
    });

    it('returns null for empty list', async () => {
      mockCratesApiCallFor('non_existent_crate');
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, '\n');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'non_existent_crate',
          registryUrls: ['https://crates.io'],
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'some_crate',
          registryUrls: ['https://crates.io'],
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'some_crate',
          registryUrls: ['https://crates.io'],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').replyWithError('');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'some_crate',
          registryUrls: ['https://crates.io'],
        }),
      ).toBeNull();
    });

    it('processes real data: libc', async () => {
      mockCratesApiCallFor('libc', Fixtures.get('libc.json'));

      httpMock
        .scope(baseUrl)
        .get('/li/bc/libc')
        .reply(200, Fixtures.get('libc'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'libc',
        registryUrls: ['https://crates.io'],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('processes real data: amethyst', async () => {
      mockCratesApiCallFor('amethyst', Fixtures.get('amethyst.json'));

      httpMock
        .scope(baseUrl)
        .get('/am/et/amethyst')
        .reply(200, Fixtures.get('amethyst'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'amethyst',
        registryUrls: ['https://crates.io'],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('refuses to clone if allowCustomCrateRegistries is not true', async () => {
      const { mockClone } = setupGitMocks();

      const url = 'https://dl.cloudsmith.io/basic/myorg/myrepo/cargo/index.git';
      const res = await getPkgReleases({
        datasource,
        packageName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalledTimes(0);
      expect(res).toBeNull();
    });

    it('clones cloudsmith private registry', async () => {
      const { mockClone } = setupGitMocks();
      GlobalConfig.set({ ...adminConfig, allowCustomCrateRegistries: true });
      const url = 'https://dl.cloudsmith.io/basic/myorg/myrepo/cargo/index.git';
      const res = await getPkgReleases({
        datasource,
        packageName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalled();
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('clones other private registry', async () => {
      const { mockClone } = setupGitMocks();
      GlobalConfig.set({ ...adminConfig, allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/testregistry';
      const res = await getPkgReleases({
        datasource,
        packageName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalled();
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('clones once then reuses the cache', async () => {
      const { mockClone } = setupGitMocks();
      GlobalConfig.set({ ...adminConfig, allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/othertestregistry';
      await getPkgReleases({
        datasource,
        packageName: 'mypkg',
        registryUrls: [url],
      });
      await getPkgReleases({
        datasource,
        packageName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalledTimes(1);
    });

    it('guards against race conditions while cloning', async () => {
      const { mockClone } = setupGitMocks(250);
      GlobalConfig.set({ ...adminConfig, allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/othertestregistry';

      await Promise.all([
        getPkgReleases({
          datasource,
          packageName: 'mypkg',
          registryUrls: [url],
        }),
        getPkgReleases({
          datasource,
          packageName: 'mypkg-2',
          registryUrls: [url],
        }),
      ]);

      await getPkgReleases({
        datasource,
        packageName: 'mypkg-3',
        registryUrls: [url],
      });

      expect(mockClone).toHaveBeenCalledTimes(1);
    });

    it('returns null when git clone fails', async () => {
      setupErrorGitMock();
      GlobalConfig.set({ ...adminConfig, allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/othertestregistry';

      const result = await getPkgReleases({
        datasource,
        packageName: 'mypkg',
        registryUrls: [url],
      });
      const result2 = await getPkgReleases({
        datasource,
        packageName: 'mypkg-2',
        registryUrls: [url],
      });

      expect(result).toBeNull();
      expect(result2).toBeNull();
    });

    it('does not clone for sparse registries', async () => {
      GlobalConfig.set({ ...adminConfig, allowCustomCrateRegistries: true });
      const { mockClone } = setupGitMocks();

      const url = 'https://github.com/mcorbin/othertestregistry';
      const sparseUrl = `sparse+${url}`;
      httpMock.scope(url).get('/my/pk/mypkg').reply(200, {});

      const res = await getPkgReleases({
        datasource,
        packageName: 'mypkg',
        registryUrls: [sparseUrl],
      });
      expect(mockClone).toHaveBeenCalledTimes(0);
      expect(res).toBeNull();
    });
  });

  describe('fetchCrateRecordsPayload', () => {
    it('rejects if it has neither clonePath nor crates.io flavor', async () => {
      const info: RegistryInfo = {
        rawUrl: 'https://example.com',
        url: new URL('https://example.com'),
        flavor: 'cloudsmith',
        isSparse: false,
      };
      const crateDatasource = new CrateDatasource();
      await expect(
        crateDatasource.fetchCrateRecordsPayload(info, 'benedict'),
      ).toReject();
    });
  });
});
