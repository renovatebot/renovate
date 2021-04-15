import delay from 'delay';
import fs from 'fs-extra';
import _simpleGit from 'simple-git';
import { DirectoryResult, dir } from 'tmp-promise';
import { dirname, join } from 'upath';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import * as memCache from '../../util/cache/memory';
import { setFsConfig } from '../../util/fs';
import {
  RegistryFlavor,
  RegistryInfo,
  id as datasource,
  fetchCrateRecordsPayload,
  getIndexSuffix,
} from '.';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

const res1 = fs.readFileSync('lib/datasource/crate/__fixtures__/libc', 'utf8');
const res2 = fs.readFileSync(
  'lib/datasource/crate/__fixtures__/amethyst',
  'utf8'
);
const res3 = fs.readFileSync('lib/datasource/crate/__fixtures__/mypkg', 'utf8');

const baseUrl =
  'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

function setupGitMocks(delayMs?: number): { mockClone: jest.Mock<any, any> } {
  const mockClone = jest
    .fn()
    .mockName('clone')
    .mockImplementation(
      async (_registryUrl: string, clonePath: string, _opts) => {
        if (delayMs > 0) {
          await delay(delayMs);
        }

        const path = `${clonePath}/my/pk/mypkg`;
        fs.mkdirSync(dirname(path), { recursive: true });
        fs.writeFileSync(path, res3, { encoding: 'utf8' });
      }
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
      Promise.reject(new Error('mocked error'))
    );

  simpleGit.mockReturnValue({
    clone: mockClone,
  });

  return { mockClone };
}

describe(getName(__filename), () => {
  describe('getIndexSuffix', () => {
    it('returns correct suffixes', () => {
      expect(getIndexSuffix('a')).toStrictEqual(['1', 'a']);
      expect(getIndexSuffix('1')).toStrictEqual(['1', '1']);
      expect(getIndexSuffix('1234567')).toStrictEqual(['12', '34', '1234567']);
      expect(getIndexSuffix('ab')).toStrictEqual(['2', 'ab']);
      expect(getIndexSuffix('abc')).toStrictEqual(['3', 'a', 'abc']);
      expect(getIndexSuffix('abcd')).toStrictEqual(['ab', 'cd', 'abcd']);
      expect(getIndexSuffix('abcde')).toStrictEqual(['ab', 'cd', 'abcde']);
    });
  });

  describe('getReleases', () => {
    let tmpDir: DirectoryResult | null;
    let localDir: string | null;
    let cacheDir: string | null;

    beforeEach(async () => {
      httpMock.setup();

      tmpDir = await dir();
      localDir = join(tmpDir.path, 'local');
      cacheDir = join(tmpDir.path, 'cache');
      setFsConfig({
        localDir,
        cacheDir,
      });
      simpleGit.mockReset();
      memCache.init();
      setAdminConfig();
    });

    afterEach(() => {
      fs.rmdirSync(tmpDir.path, { recursive: true });
      tmpDir = null;
      setAdminConfig();

      httpMock.reset();
    });

    it('returns null for missing registry url', async () => {
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('returns null for invalid registry url', async () => {
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
          registryUrls: ['3'],
        })
      ).toBeNull();
    });
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
          registryUrls: ['https://crates.io'],
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/no/n_/non_existent_crate')
        .reply(200, undefined);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
          registryUrls: ['https://crates.io'],
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty list', async () => {
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, '\n');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
          registryUrls: ['https://crates.io'],
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'some_crate',
          registryUrls: ['https://crates.io'],
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(502);
      let e;
      try {
        await getPkgReleases({
          datasource,
          depName: 'some_crate',
          registryUrls: ['https://crates.io'],
        });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').replyWithError('');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'some_crate',
          registryUrls: ['https://crates.io'],
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data: libc', async () => {
      httpMock.scope(baseUrl).get('/li/bc/libc').reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName: 'libc',
        registryUrls: ['https://crates.io'],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data: amethyst', async () => {
      httpMock.scope(baseUrl).get('/am/et/amethyst').reply(200, res2);
      const res = await getPkgReleases({
        datasource,
        depName: 'amethyst',
        registryUrls: ['https://crates.io'],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('refuses to clone if allowCustomCrateRegistries is not true', async () => {
      const { mockClone } = setupGitMocks();

      const url = 'https://dl.cloudsmith.io/basic/myorg/myrepo/cargo/index.git';
      const res = await getPkgReleases({
        datasource,
        depName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalledTimes(0);
      expect(res).toMatchSnapshot();
      expect(res).toBeNull();
    });
    it('clones cloudsmith private registry', async () => {
      const { mockClone } = setupGitMocks();
      setAdminConfig({ allowCustomCrateRegistries: true });
      const url = 'https://dl.cloudsmith.io/basic/myorg/myrepo/cargo/index.git';
      const res = await getPkgReleases({
        datasource,
        depName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalled();
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('clones other private registry', async () => {
      const { mockClone } = setupGitMocks();
      setAdminConfig({ allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/testregistry';
      const res = await getPkgReleases({
        datasource,
        depName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalled();
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('clones once then reuses the cache', async () => {
      const { mockClone } = setupGitMocks();
      setAdminConfig({ allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/othertestregistry';
      await getPkgReleases({
        datasource,
        depName: 'mypkg',
        registryUrls: [url],
      });
      await getPkgReleases({
        datasource,
        depName: 'mypkg',
        registryUrls: [url],
      });
      expect(mockClone).toHaveBeenCalledTimes(1);
    });
    it('guards against race conditions while cloning', async () => {
      const { mockClone } = setupGitMocks(250);
      setAdminConfig({ allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/othertestregistry';

      await Promise.all([
        getPkgReleases({
          datasource,
          depName: 'mypkg',
          registryUrls: [url],
        }),
        getPkgReleases({
          datasource,
          depName: 'mypkg-2',
          registryUrls: [url],
        }),
      ]);

      await getPkgReleases({
        datasource,
        depName: 'mypkg-3',
        registryUrls: [url],
      });

      expect(mockClone).toHaveBeenCalledTimes(1);
    });
    it('returns null when git clone fails', async () => {
      setupErrorGitMock();
      setAdminConfig({ allowCustomCrateRegistries: true });
      const url = 'https://github.com/mcorbin/othertestregistry';

      const result = await getPkgReleases({
        datasource,
        depName: 'mypkg',
        registryUrls: [url],
      });
      const result2 = await getPkgReleases({
        datasource,
        depName: 'mypkg-2',
        registryUrls: [url],
      });

      expect(result).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('fetchCrateRecordsPayload', () => {
    it('rejects if it has neither clonePath nor crates.io flavor', async () => {
      const info: RegistryInfo = {
        flavor: RegistryFlavor.Cloudsmith,
      };
      await expect(fetchCrateRecordsPayload(info, 'benedict')).toReject();
    });
  });
});
