import fs from 'fs-extra';
import type { SimpleGit } from 'simple-git';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import type { MockedFunction } from 'vitest';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as git from '../../../util/git/index.ts';
import { getPkgReleases } from '../index.ts';
import { JuliaDatasource } from './index.ts';

vi.unmock('../../../util/mutex.ts');
const createSimpleGit = vi.mocked(git.createSimpleGit);

const datasource = JuliaDatasource.id;
const registryUrl = 'https://example.com/Registry.git';
const otherRegistryUrl = 'https://example.com/Other.git';
const exampleUuid = '7876af07-990d-54b4-ab0e-23690620f79a';

const registry = `
name = "Registry"
uuid = "23338594-aafe-5451-b93e-139f81909106"

[packages]
${exampleUuid} = { name = "Example", path = "E/Example" }
11111111-1111-1111-1111-111111111111 = { name = "Twin", path = "T/Twin" }
22222222-2222-2222-2222-222222222222 = { name = "Twin", path = "T/Twin_2" }
`;

const files: Record<string, Record<string, string>> = {
  [registryUrl]: {
    'Registry.toml': registry,
    'E/Example/Package.toml': `
name = "Example"
uuid = "${exampleUuid}"
repo = "https://github.com/JuliaLang/Example.jl.git"
`,
    'T/Twin_2/Package.toml': 'name = "Twin"\n',
    'T/Twin_2/Versions.toml': '["1.0.0"]\ngit-tree-sha1 = "0"\n',
    'E/Example/Versions.toml': `
["0.5.4"]
git-tree-sha1 = "46e44e869b4d90b96bd8ed1fdcf32244fddfb6cc"

["0.5.5"]
git-tree-sha1 = "8eb7b4d4ca487caade9ba3e85932e28ce6d6e1f8"
yanked = true
`,
  },
  [otherRegistryUrl]: {
    'Registry.toml': '[packages]\n',
  },
};

// `git blame --line-porcelain` of E/Example/Versions.toml, trimmed to the
// fields the datasource reads.
const exampleBlame = [
  'aaaa 1 1 3',
  'committer-time 1563341626',
  '\t["0.5.4"]',
  'aaaa 2 2',
  'committer-time 1563341626',
  '\tgit-tree-sha1 = "46e44e869b4d90b96bd8ed1fdcf32244fddfb6cc"',
  'bbbb 4 4 3',
  'committer-time 1600000000',
  '\t["0.5.5"]',
  '',
].join('\n');

function mockClone(
  raw: SimpleGit['raw'] = vi.fn().mockResolvedValue(''),
  registries: Record<string, Record<string, string>> = files,
): MockedFunction<SimpleGit['clone']> {
  const clone = vi
    .fn()
    .mockImplementation(async (url: string, clonePath: string) => {
      for (const [name, content] of Object.entries(registries[url])) {
        const path = upath.join(clonePath, name);
        await fs.mkdir(upath.dirname(path), { recursive: true });
        await fs.writeFile(path, content);
      }
    });
  createSimpleGit.mockReturnValue(partial<SimpleGit>({ clone, raw }));
  return clone;
}

describe('modules/datasource/julia/index', () => {
  let tmpDir: DirectoryResult | null;

  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: upath.join(tmpDir.path, 'cache') });
    memCache.init();
  });

  afterEach(async () => {
    await tmpDir?.cleanup();
    tmpDir = null;
    GlobalConfig.reset();
  });

  describe('getReleases', () => {
    it('returns releases by name', async () => {
      mockClone(vi.fn().mockResolvedValue(exampleBlame));
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'Example',
          registryUrls: [registryUrl],
        }),
      ).resolves.toEqual({
        registryUrl,
        sourceUrl: 'https://github.com/JuliaLang/Example.jl',
        releases: [
          { version: '0.5.4', releaseTimestamp: '2019-07-17T05:33:46.000Z' },
          {
            version: '0.5.5',
            releaseTimestamp: '2020-09-13T12:26:40.000Z',
            isDeprecated: true,
          },
        ],
      });
    });

    it('omits a timestamp that cannot be parsed', async () => {
      mockClone(
        vi
          .fn()
          .mockResolvedValue(
            exampleBlame.replace(
              'committer-time 1600000000',
              'committer-time x',
            ),
          ),
      );
      const result = await getPkgReleases({
        datasource,
        packageName: 'Example',
        registryUrls: [registryUrl],
      });
      expect(result?.releases[1]).toEqual({
        version: '0.5.5',
        isDeprecated: true,
      });
    });

    it('returns releases without timestamps when git blame fails', async () => {
      mockClone(vi.fn().mockRejectedValue(new Error('blame failed')));
      const result = await getPkgReleases({
        datasource,
        packageName: 'Example',
        registryUrls: [registryUrl],
      });
      expect(result?.releases).toEqual([
        { version: '0.5.4' },
        { version: '0.5.5', isDeprecated: true },
      ]);
    });

    it('returns releases by name and UUID', async () => {
      mockClone();
      const result = await getPkgReleases({
        datasource,
        packageName: `Example=${exampleUuid.toUpperCase()}`,
        registryUrls: [registryUrl],
      });
      expect(result?.releases).toHaveLength(2);
    });

    it.each([
      'Example=00000000-0000-0000-0000-000000000000',
      `Other=${exampleUuid}`,
    ])(
      'returns null when name and UUID do not match: %s',
      async (packageName) => {
        mockClone();
        await expect(
          getPkgReleases({
            datasource,
            packageName,
            registryUrls: [registryUrl],
          }),
        ).resolves.toBeNull();
      },
    );

    it('finds one of two packages with the same name by UUID', async () => {
      mockClone();
      const result = await getPkgReleases({
        datasource,
        packageName: 'Twin=22222222-2222-2222-2222-222222222222',
        registryUrls: [registryUrl],
      });
      expect(result?.releases).toEqual([{ version: '1.0.0' }]);
    });

    it('returns null for an ambiguous name', async () => {
      mockClone();
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'Twin',
          registryUrls: [registryUrl],
        }),
      ).resolves.toBeNull();
    });

    it.each(['Unknown', 'Unknown=00000000-0000-0000-0000-000000000000'])(
      'returns null for an unknown package %s',
      async (packageName) => {
        mockClone();
        await expect(
          getPkgReleases({
            datasource,
            packageName,
            registryUrls: [registryUrl],
          }),
        ).resolves.toBeNull();
      },
    );

    it('tries each registry until one has the package', async () => {
      const clone = mockClone();
      const result = await getPkgReleases({
        datasource,
        packageName: 'Example',
        registryUrls: [otherRegistryUrl, registryUrl],
      });
      expect(result?.registryUrl).toBe(registryUrl);
      expect(clone).toHaveBeenCalledTimes(2);
    });

    it('clones each registry once', async () => {
      const clone = mockClone();
      for (const packageName of ['Example', 'Unknown']) {
        await getPkgReleases({
          datasource,
          packageName,
          registryUrls: [registryUrl],
        });
      }
      expect(clone).toHaveBeenCalledTimes(1);
    });

    it('clones an SSH registry URL without host rule credentials', async () => {
      const sshRegistryUrl = 'git@example.com:Registry.git';
      mockClone(undefined, { [sshRegistryUrl]: files[registryUrl] });
      const result = await getPkgReleases({
        datasource,
        packageName: 'Example',
        registryUrls: [sshRegistryUrl],
      });
      expect(result?.releases).toHaveLength(2);
      expect(createSimpleGit).toHaveBeenCalledWith({
        config: { maxConcurrentProcesses: 1 },
      });
    });

    it('returns null when the clone fails, and does not retry', async () => {
      const clone = vi.fn().mockRejectedValue(new Error('clone failed'));
      createSimpleGit.mockReturnValue(partial<SimpleGit>({ clone }));
      for (const packageName of ['Example', 'Unknown']) {
        await expect(
          getPkgReleases({
            datasource,
            packageName,
            registryUrls: [registryUrl],
          }),
        ).resolves.toBeNull();
      }
      expect(clone).toHaveBeenCalledTimes(1);
    });

    it.each([
      'file:///srv/Registry',
      '/srv/Registry',
      'ext::sh -c touch% /tmp/x',
      '-o@example.com:Registry.git',
    ])('does not clone the registry URL %s', async (url) => {
      const clone = mockClone();
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'Example',
          registryUrls: [url],
        }),
      ).resolves.toBeNull();
      expect(clone).not.toHaveBeenCalled();
    });

    it('does not read a package path outside the clone', async () => {
      const escapeRegistryUrl = 'https://example.com/Escape.git';
      mockClone(undefined, {
        [escapeRegistryUrl]: {
          'Registry.toml': `[packages]\n${exampleUuid} = { name = "Example", path = "../Escape" }\n`,
        },
      });
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'Example',
          registryUrls: [escapeRegistryUrl],
        }),
      ).resolves.toBeNull();
    });

    it('clones an ssh:// registry URL', async () => {
      const sshRegistryUrl = 'ssh://git@example.com/Registry.git';
      mockClone(undefined, { [sshRegistryUrl]: files[registryUrl] });
      const result = await getPkgReleases({
        datasource,
        packageName: 'Example',
        registryUrls: [sshRegistryUrl],
      });
      expect(result?.releases).toHaveLength(2);
    });

    it.each([
      'General',
      '23338594-AAFE-5451-B93E-139F81909106',
      'https://github.com/JuliaRegistries/General',
      'https://github.com/JuliaRegistries/General.git',
    ])('looks up %s via GeneralMetadata.jl', async (url) => {
      const clone = mockClone();
      httpMock
        .scope('https://juliaregistries.github.io/GeneralMetadata.jl/api')
        .get('/Example/info.json')
        .reply(200, { name: 'Example', uuid: exampleUuid })
        .get('/Example/versions.json')
        .reply(200, { '0.5.4': { registered: '2019-07-17T05:33:46' } });
      const result = await getPkgReleases({
        datasource,
        packageName: `Example=${exampleUuid}`,
        registryUrls: [url],
      });
      expect(result?.releases).toEqual([
        { version: '0.5.4', releaseTimestamp: '2019-07-17T05:33:46.000Z' },
      ]);
      expect(clone).not.toHaveBeenCalled();
    });

    it('does not take a lowercase general for General', async () => {
      mockClone();
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'Example',
          registryUrls: ['general'],
        }),
      ).resolves.toBeNull();
    });

    it('tries General first when it is listed first', async () => {
      const clone = mockClone();
      const holyLabUuid = '22222222-2222-2222-2222-222222222222';
      httpMock
        .scope('https://juliaregistries.github.io/GeneralMetadata.jl/api')
        .get('/Twin/info.json')
        .reply(200, {
          name: 'Twin',
          uuid: '33333333-3333-3333-3333-333333333333',
        })
        .get('/Twin/versions.json')
        .reply(200, { '1.0.0': { registered: '2024-01-01T00:00:00' } });
      const result = await getPkgReleases({
        datasource,
        packageName: `Twin=${holyLabUuid}`,
        registryUrls: ['General', registryUrl],
      });
      expect(result?.registryUrl).toBe(registryUrl);
      expect(clone).toHaveBeenCalledTimes(1);
    });

    it('looks up General by default', async () => {
      const clone = mockClone();
      httpMock
        .scope('https://juliaregistries.github.io/GeneralMetadata.jl/api')
        .get('/Example/versions.json')
        .reply(200, { '0.5.4': { registered: '2019-07-17T05:33:46' } });
      const result = await getPkgReleases({
        datasource,
        packageName: 'Example',
      });
      expect(result?.registryUrl).toBe('General');
      expect(clone).not.toHaveBeenCalled();
    });
  });
});
