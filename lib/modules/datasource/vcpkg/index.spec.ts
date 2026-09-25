import fs from 'fs-extra';
import type { SimpleGit } from 'simple-git';
import { setTimeout } from 'timers/promises';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import type { MockedFunction } from 'vitest';
import { Fixtures } from '~test/fixtures.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as git from '../../../util/git/index.ts';
import { getPkgReleases } from '../index.ts';
import { VcpkgDatasource } from './index.ts';

vi.unmock('../../../util/mutex.ts');
const createSimpleGit = vi.mocked(git.createSimpleGit);

const datasource = VcpkgDatasource.id;

function setupGitMocks(
  portName: string,
  firstLetter: string,
  fixtureName: string,
  delayMs?: number,
): { mockClone: MockedFunction<SimpleGit['clone']> } {
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
        fs.mkdirSync(upath.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, Fixtures.get(fixtureName), {
          encoding: 'utf8',
        });
      },
    );

  const gitMock = partial<SimpleGit>({ clone: mockClone });
  createSimpleGit.mockReturnValue(gitMock);
  return { mockClone };
}

function setupEmptyGitMock(): {
  mockClone: MockedFunction<SimpleGit['clone']>;
} {
  const mockClone = vi
    .fn()
    .mockName('clone')
    .mockImplementation((_registryUrl: string, clonePath: string) => {
      fs.mkdirSync(clonePath, { recursive: true });
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
      localDir: upath.join(tmpDir.path, 'local'),
      cacheDir: upath.join(tmpDir.path, 'cache'),
    };
    GlobalConfig.set(adminConfig);

    createSimpleGit.mockReset();
    memCache.init();
  });

  afterEach(async () => {
    await tmpDir?.cleanup();
    tmpDir = null;
    GlobalConfig.reset();
  });

  it('returns null for invalid registry url', async () => {
    expect(
      await getPkgReleases({
        datasource,
        packageName: 'zlib',
        registryUrls: ['not a url'],
      }),
    ).toBeNull();
  });

  it('returns releases for the zlib fixture using the default registry url', async () => {
    setupGitMocks('zlib', 'z', 'zlib.json');
    const res = await getPkgReleases({
      datasource,
      packageName: 'zlib',
    });
    expect(res).not.toBeNull();
    expect(res?.registryUrl).toBe('https://github.com/microsoft/vcpkg');
    expect(res?.releases).toEqual(
      expect.arrayContaining([
        { version: '1.3.1', newDigest: 'a'.repeat(40) },
        { version: '1.3#1', newDigest: 'b'.repeat(40) },
        { version: '1.3', newDigest: 'c'.repeat(40) },
        { version: '1.2.13', newDigest: 'd'.repeat(40) },
        { version: '2022-09-15', newDigest: 'e'.repeat(40) },
        { version: '1.2.12', newDigest: 'f'.repeat(40) },
      ]),
    );
    expect(res?.releases).toHaveLength(6);
  });

  it('uses a custom registry url and uppercased port names', async () => {
    setupGitMocks('Zlib', 'z', 'zlib.json');
    const res = await getPkgReleases({
      datasource,
      packageName: 'Zlib',
      registryUrls: ['https://example.com/my-vcpkg-registry'],
    });
    expect(res).not.toBeNull();
    expect(res?.releases).toHaveLength(6);
  });

  it('returns null when the port file is missing', async () => {
    setupEmptyGitMock();
    const res = await getPkgReleases({
      datasource,
      packageName: 'nonexistent',
    });
    expect(res).toBeNull();
  });

  it('returns null when the port file is unparseable', async () => {
    setupGitMocks('zlib', 'z', 'unparseable.json');
    const res = await getPkgReleases({
      datasource,
      packageName: 'zlib',
    });
    expect(res).toBeNull();
  });

  it('clones once then reuses the cache for subsequent ports', async () => {
    const mockClone = vi
      .fn()
      .mockName('clone')
      .mockImplementation((_registryUrl: string, clonePath: string, _opts) => {
        for (const name of ['zlib', 'zstd']) {
          const filePath = upath.join(
            clonePath,
            'versions',
            'z-',
            `${name}.json`,
          );
          fs.mkdirSync(upath.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, Fixtures.get('zlib.json'), {
            encoding: 'utf8',
          });
        }
      });
    const gitMock = partial<SimpleGit>({ clone: mockClone });
    createSimpleGit.mockReturnValue(gitMock);

    const res1 = await getPkgReleases({ datasource, packageName: 'zlib' });
    const res2 = await getPkgReleases({ datasource, packageName: 'zstd' });
    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();
    expect(mockClone).toHaveBeenCalledTimes(1);
  });

  it('guards against race conditions while cloning', async () => {
    const { mockClone } = setupGitMocks('zlib', 'z', 'zlib.json', 250);
    await Promise.all([
      getPkgReleases({ datasource, packageName: 'zlib' }),
      getPkgReleases({ datasource, packageName: 'zlib' }),
    ]);
    expect(mockClone).toHaveBeenCalledTimes(1);
  });

  it('returns null when git clone fails', async () => {
    setupErrorGitMock();
    const res = await getPkgReleases({
      datasource,
      packageName: 'zlib',
    });
    const res2 = await getPkgReleases({
      datasource,
      packageName: 'curl',
    });
    expect(res).toBeNull();
    expect(res2).toBeNull();
  });

  it('retries if shallow fails because of a dumb http git repo', async () => {
    const mockClone = vi
      .fn()
      .mockName('clone')
      .mockImplementation((_registryUrl: string, clonePath: string, opts) => {
        if (typeof opts !== 'undefined' && Object.hasOwn(opts, '--depth')) {
          return Promise.reject(
            new Error(
              'fatal: dumb http transport does not support shallow capabilities',
            ),
          );
        }
        const filePath = upath.join(clonePath, 'versions', 'z-', 'zlib.json');
        fs.mkdirSync(upath.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, Fixtures.get('zlib.json'), {
          encoding: 'utf8',
        });
      });
    const gitMock = partial<SimpleGit>({ clone: mockClone });
    createSimpleGit.mockReturnValue(gitMock);

    const res = await getPkgReleases({
      datasource,
      packageName: 'zlib',
    });
    expect(mockClone).toHaveBeenCalledTimes(2);
    expect(res).not.toBeNull();
  });

  it('retries if shallow fails but retry can also fail', async () => {
    const mockClone = vi
      .fn()
      .mockName('clone')
      .mockImplementation((_registryUrl: string, _clonePath: string, opts) => {
        if (typeof opts !== 'undefined' && Object.hasOwn(opts, '--depth')) {
          return Promise.reject(
            new Error(
              'fatal: dumb http transport does not support shallow capabilities',
            ),
          );
        }
        return Promise.reject(new Error('mocked error'));
      });
    const gitMock = partial<SimpleGit>({ clone: mockClone });
    createSimpleGit.mockReturnValue(gitMock);

    const res = await getPkgReleases({
      datasource,
      packageName: 'zlib',
    });
    expect(mockClone).toHaveBeenCalledTimes(2);
    expect(res).toBeNull();
  });

  it('respects the explicit gitTimeout setting', async () => {
    const { mockClone } = setupGitMocks('zlib', 'z', 'zlib.json');
    GlobalConfig.set({ ...adminConfig, gitTimeout: 30000 });
    const res = await getPkgReleases({
      datasource,
      packageName: 'zlib',
    });
    expect(mockClone).toHaveBeenCalled();
    expect(res).not.toBeNull();
  });
});
