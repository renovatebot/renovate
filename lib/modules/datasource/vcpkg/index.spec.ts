import { setTimeout } from 'node:timers/promises';
import fs from 'fs-extra';
import type { SimpleGit } from 'simple-git';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import type { MockedFunction } from 'vitest';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as git from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { getPkgReleases } from '../index.ts';
import { VcpkgDatasource } from './index.ts';

vi.unmock('../../../util/mutex.ts');
const createSimpleGit = vi.mocked(git.createSimpleGit);

const datasource = VcpkgDatasource.id;
const registryUrl = 'https://example.com/my-vcpkg-registry';
const defaultRegistryFiles =
  'https://raw.githubusercontent.com/microsoft/vcpkg/HEAD';
const zlibReleases = [
  { version: '1.3.1' },
  { version: '1.3#1' },
  { version: '1.3' },
  { version: '1.2.13' },
  { version: '2022-09-15' },
  { version: '1.2.12' },
];

// The commit times that the blame gives each zlib.json version: the newest
// two versions have their own commits, the others the first one.
const zlibTimestamps = {
  '1.3.1': '2026-11-13T16:31:43.000Z',
  '1.3#1': '2026-11-04T19:58:28.000Z',
  '1.3': '2021-01-15T00:08:36.000Z',
  '1.2.13': '2021-01-15T00:08:36.000Z',
  '2022-09-15': '2021-01-15T00:08:36.000Z',
  '1.2.12': '2021-01-15T00:08:36.000Z',
};

function graphqlBlame(text: string): Record<string, unknown> {
  return {
    data: {
      repository: {
        object: {
          file: { object: { text } },
          blame: {
            ranges: [
              {
                startingLine: 1,
                endingLine: 2,
                commit: { committedDate: '2021-01-15T00:08:36Z' },
              },
              {
                startingLine: 3,
                endingLine: 7,
                commit: { committedDate: '2026-11-13T16:31:43Z' },
              },
              {
                startingLine: 8,
                endingLine: 12,
                commit: { committedDate: '2026-11-04T19:58:28Z' },
              },
              {
                startingLine: 13,
                endingLine: 31,
                commit: { committedDate: '2021-01-15T00:08:36Z' },
              },
            ],
          },
        },
      },
    },
  };
}

// `git blame --line-porcelain` of a versions file, trimmed to the lines that
// matter: each line's committer time, then the line.
function porcelainBlame(text: string): string {
  return text
    .split('\n')
    .flatMap((line, index) => {
      let committerTime = '1610669316';
      if (line.includes('ffffffff')) {
        // The oldest version's line has an invalid committer time.
        committerTime = 'x';
      } else if (index < 7) {
        committerTime = '1794587503';
      } else if (index < 12) {
        committerTime = '1793822308';
      }
      return [`committer-time ${committerTime}`, `\t${line}`];
    })
    .join('\n');
}

function setupGitMocks(
  portName: string,
  firstLetter: string,
  fixtureName: string,
  delayMs?: number,
): {
  mockClone: MockedFunction<SimpleGit['clone']>;
  mockRaw: MockedFunction<SimpleGit['raw']>;
} {
  const mockClone = vi
    .fn()
    .mockName('clone')
    .mockImplementation(
      async (_registryUrl: string, clonePath: string, _opts) => {
        if (delayMs && delayMs > 0) {
          await setTimeout(delayMs);
        }
        const filePath = upath.join(
          clonePath,
          'versions',
          `${firstLetter}-`,
          `${portName}.json`,
        );
        await fs.mkdir(upath.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, Fixtures.get(fixtureName), {
          encoding: 'utf8',
        });
      },
    );

  const mockRaw = vi
    .fn()
    .mockName('raw')
    .mockResolvedValue(porcelainBlame(Fixtures.get(fixtureName)));
  const gitMock = partial<SimpleGit>({ clone: mockClone, raw: mockRaw });
  createSimpleGit.mockReturnValue(gitMock);
  return { mockClone, mockRaw };
}

function setupEmptyGitMock(): {
  mockClone: MockedFunction<SimpleGit['clone']>;
} {
  const mockClone = vi
    .fn()
    .mockName('clone')
    .mockImplementation(async (_registryUrl: string, clonePath: string) => {
      await fs.mkdir(clonePath, { recursive: true });
    });
  const gitMock = partial<SimpleGit>({ clone: mockClone });
  createSimpleGit.mockReturnValue(gitMock);
  return { mockClone };
}

function setupErrorGitMock(): {
  mockClone: MockedFunction<SimpleGit['clone']>;
} {
  const mockClone = vi
    .fn()
    .mockName('clone')
    .mockImplementation(() => Promise.reject(new Error('mocked error')));

  const gitMock = partial<SimpleGit>({ clone: mockClone });
  createSimpleGit.mockReturnValue(gitMock);
  return { mockClone };
}

describe('modules/datasource/vcpkg/index', () => {
  let tmpDir: DirectoryResult | null;
  let adminConfig: RepoGlobalConfig;

  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });

    adminConfig = {
      cacheDir: upath.join(tmpDir.path, 'cache'),
    };
    GlobalConfig.set(adminConfig);

    memCache.init();
  });

  afterEach(async () => {
    await tmpDir?.cleanup();
    tmpDir = null;
    GlobalConfig.reset();
    hostRules.clear();
  });

  describe('default registry', () => {
    it('fetches the port file over HTTP', async () => {
      const { mockClone } = setupGitMocks('zlib', 'z', 'zlib.json');
      httpMock
        .scope(defaultRegistryFiles)
        .get('/versions/z-/zlib.json')
        .reply(200, Fixtures.get('zlib.json'));

      const res = await getPkgReleases({ datasource, packageName: 'zlib' });

      expect(res?.registryUrl).toBe('https://github.com/microsoft/vcpkg');
      expect(res?.releases).toEqual(expect.arrayContaining(zlibReleases));
      expect(res?.releases).toHaveLength(zlibReleases.length);
      expect(mockClone).not.toHaveBeenCalled();
    });

    it('dates the releases with a github.com token', async () => {
      hostRules.add({
        hostType: 'github',
        matchHost: 'github.com',
        token: 't',
      });
      httpMock
        .scope(defaultRegistryFiles)
        .get('/versions/z-/zlib.json')
        .reply(200, Fixtures.get('zlib.json'));
      httpMock
        .scope('https://api.github.com')
        .post(
          '/graphql',
          (body) => body.variables.path === 'versions/z-/zlib.json',
        )
        .reply(200, graphqlBlame(Fixtures.get('zlib.json')));

      const res = await getPkgReleases({ datasource, packageName: 'zlib' });

      expect(res?.releases).toEqual(
        expect.arrayContaining(
          Object.entries(zlibTimestamps).map(([version, releaseTimestamp]) => ({
            version,
            releaseTimestamp,
          })),
        ),
      );
    });

    it('returns undated releases when GitHub returns no blame', async () => {
      hostRules.add({
        hostType: 'github',
        matchHost: 'github.com',
        token: 't',
      });
      httpMock
        .scope(defaultRegistryFiles)
        .get('/versions/z-/zlib.json')
        .reply(200, Fixtures.get('zlib.json'));
      httpMock
        .scope('https://api.github.com')
        .post('/graphql')
        .reply(200, { errors: [{ message: 'blame failed' }] });

      const res = await getPkgReleases({ datasource, packageName: 'zlib' });

      expect(res?.releases).toEqual(expect.arrayContaining(zlibReleases));
      expect(res?.releases).toHaveLength(zlibReleases.length);
    });

    it('returns null when the registry has no such port', async () => {
      httpMock
        .scope(defaultRegistryFiles)
        .get('/versions/n-/nonexistent.json')
        .reply(404);

      await expect(
        getPkgReleases({ datasource, packageName: 'nonexistent' }),
      ).resolves.toBeNull();
    });

    it('returns null when the port file is unparseable', async () => {
      httpMock
        .scope(defaultRegistryFiles)
        .get('/versions/z-/zlib.json')
        .reply(200, Fixtures.get('unparseable.json'));

      await expect(
        getPkgReleases({ datasource, packageName: 'zlib' }),
      ).resolves.toBeNull();
    });

    it('fails the lookup on a server error', async () => {
      httpMock
        .scope(defaultRegistryFiles)
        .get('/versions/z-/zlib.json')
        .reply(500);

      await expect(
        getPkgReleases({ datasource, packageName: 'zlib' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });

  describe('custom registry', () => {
    beforeEach(() => {
      GlobalConfig.set({ ...adminConfig, allowCustomVcpkgRegistries: true });
    });

    it('is not cloned without allowCustomVcpkgRegistries', async () => {
      GlobalConfig.set(adminConfig);
      const { mockClone } = setupGitMocks('zlib', 'z', 'zlib.json');

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'zlib',
          registryUrls: [registryUrl],
        }),
      ).resolves.toBeNull();
      expect(mockClone).not.toHaveBeenCalled();
    });

    it('returns null for an invalid registry url', async () => {
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'zlib',
          registryUrls: ['not a url'],
        }),
      ).resolves.toBeNull();
    });

    it('clones the registry with its host rules and reads uppercased ports', async () => {
      const { mockClone } = setupGitMocks('Zlib', 'z', 'zlib.json');

      const res = await getPkgReleases({
        datasource,
        packageName: 'Zlib',
        registryUrls: [registryUrl],
      });

      expect(res?.releases).toEqual(
        expect.arrayContaining(
          zlibReleases.map((release) => expect.objectContaining(release)),
        ),
      );
      expect(mockClone).toHaveBeenCalledTimes(1);
      expect(createSimpleGit).toHaveBeenCalledWith({
        config: { maxConcurrentProcesses: 1 },
        authentication: { hostTypes: ['vcpkg'], url: registryUrl },
      });
    });

    it('dates the releases from the clone', async () => {
      setupGitMocks('zlib', 'z', 'zlib.json');

      const res = await getPkgReleases({
        datasource,
        packageName: 'zlib',
        registryUrls: [registryUrl],
      });

      expect(res?.releases).toEqual(
        expect.arrayContaining([
          ...Object.entries(zlibTimestamps)
            .filter(([version]) => version !== '1.2.12')
            .map(([version, releaseTimestamp]) => ({
              version,
              releaseTimestamp,
            })),
          { version: '1.2.12' },
        ]),
      );
    });

    it('returns undated releases when git blame fails', async () => {
      const { mockRaw } = setupGitMocks('zlib', 'z', 'zlib.json');
      mockRaw.mockRejectedValue(new Error('blame failed'));

      const res = await getPkgReleases({
        datasource,
        packageName: 'zlib',
        registryUrls: [registryUrl],
      });

      expect(res?.releases).toEqual(expect.arrayContaining(zlibReleases));
      expect(res?.releases).toHaveLength(zlibReleases.length);
    });

    it('clones an ssh registry without host rules', async () => {
      setupGitMocks('zlib', 'z', 'zlib.json');

      await getPkgReleases({
        datasource,
        packageName: 'zlib',
        registryUrls: ['ssh://git@example.com/my-vcpkg-registry'],
      });

      expect(createSimpleGit).toHaveBeenCalledWith({
        config: { maxConcurrentProcesses: 1 },
      });
    });

    it('returns null when the port file is missing', async () => {
      setupEmptyGitMock();

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'nonexistent',
          registryUrls: [registryUrl],
        }),
      ).resolves.toBeNull();
    });

    it('returns null when the port file is unparseable', async () => {
      setupGitMocks('zlib', 'z', 'unparseable.json');

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'zlib',
          registryUrls: [registryUrl],
        }),
      ).resolves.toBeNull();
    });

    it('clones once then reuses the clone for subsequent ports', async () => {
      const mockClone = vi
        .fn()
        .mockName('clone')
        .mockImplementation(
          async (_registryUrl: string, clonePath: string, _opts) => {
            for (const name of ['zlib', 'zstd']) {
              const filePath = upath.join(
                clonePath,
                'versions',
                'z-',
                `${name}.json`,
              );
              await fs.mkdir(upath.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, Fixtures.get('zlib.json'), {
                encoding: 'utf8',
              });
            }
          },
        );
      createSimpleGit.mockReturnValue(partial<SimpleGit>({ clone: mockClone }));

      const res1 = await getPkgReleases({
        datasource,
        packageName: 'zlib',
        registryUrls: [registryUrl],
      });
      const res2 = await getPkgReleases({
        datasource,
        packageName: 'zstd',
        registryUrls: [registryUrl],
      });

      expect(res1).not.toBeNull();
      expect(res2).not.toBeNull();
      expect(mockClone).toHaveBeenCalledTimes(1);
    });

    it('guards against race conditions while cloning', async () => {
      const { mockClone } = setupGitMocks('zlib', 'z', 'zlib.json', 250);

      await Promise.all([
        getPkgReleases({
          datasource,
          packageName: 'zlib',
          registryUrls: [registryUrl],
        }),
        getPkgReleases({
          datasource,
          packageName: 'zlib',
          registryUrls: [registryUrl],
        }),
      ]);

      expect(mockClone).toHaveBeenCalledTimes(1);
    });

    it('returns null when git clone fails, and does not clone again', async () => {
      const { mockClone } = setupErrorGitMock();

      const res = await getPkgReleases({
        datasource,
        packageName: 'zlib',
        registryUrls: [registryUrl],
      });
      const res2 = await getPkgReleases({
        datasource,
        packageName: 'curl',
        registryUrls: [registryUrl],
      });

      expect(res).toBeNull();
      expect(res2).toBeNull();
      expect(mockClone).toHaveBeenCalledTimes(1);
    });

    it('respects the explicit gitTimeout setting', async () => {
      const { mockClone } = setupGitMocks('zlib', 'z', 'zlib.json');
      GlobalConfig.set({
        ...adminConfig,
        allowCustomVcpkgRegistries: true,
        gitTimeout: 30000,
      });

      const res = await getPkgReleases({
        datasource,
        packageName: 'zlib',
        registryUrls: [registryUrl],
      });

      expect(mockClone).toHaveBeenCalled();
      expect(res).not.toBeNull();
    });
  });
});
