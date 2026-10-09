import type { IGitApi } from 'azure-devops-node-api/GitApi.js';
import { GitObjectType } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import { Fixtures } from '~test/fixtures.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../../../config/global.ts';
import * as azureApi from '../../../../../../modules/platform/azure/azure-got-wrapper.ts';
import * as azureHelper from '../../../../../../modules/platform/azure/azure-helper.ts';
import * as semverVersioning from '../../../../../../modules/versioning/semver/index.ts';
import * as memCache from '../../../../../../util/cache/memory/index.ts';
import * as packageCache from '../../../../../../util/cache/package/index.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import type { ChangeLogProject, ChangeLogRelease } from '../index.ts';
import { getReleaseNotesMdFile as getReleaseNotesMdFileRaw } from '../release-notes.ts';
import { AzureChangeLogSource } from './source.ts';

const baseUrl = 'https://dev.azure.com/some-org/some-project/';
const apiBaseUrl = 'https://dev.azure.com/some-org/some-project/_apis/';

const upgrade = partial<BranchUpgradeConfig>({
  branchName: '',
  packageName: 'renovate',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: `https://dev.azure.com/some-org/some-project/_git/some-repo/`,
  releases: [
    { version: '5.2.0' },
    {
      version: '5.4.0',
    },
    { version: '5.5.0' },
    { version: '5.6.0' },
    { version: '5.6.1' },
  ],
});

const changelogSource = new AzureChangeLogSource();

function getReleaseNotesMdFile(project: ChangeLogProject) {
  return getReleaseNotesMdFileRaw(project, changelogSource);
}

const azureProject = partial<ChangeLogProject>({
  type: 'azure',
  repository: 'some-repo',
  baseUrl,
  apiBaseUrl,
});

describe('workers/repository/update/pr/changelog/azure/source', () => {
  describe('URL handling', () => {
    it('skips malformed encoded projects without calling SDK helpers', async () => {
      const getItem = vi.spyOn(azureHelper, 'getItem');
      const gitApi = vi.spyOn(azureApi, 'gitApi');
      const endpoint = 'https://dev.azure.com/org/%zz/_apis/';

      await expect(
        changelogSource.getReleaseNotesMd('repo', endpoint),
      ).resolves.toBeNull();
      await expect(
        changelogSource.getAllTags(endpoint, 'repo'),
      ).resolves.toEqual([]);

      expect(getItem).not.toHaveBeenCalled();
      expect(gitApi).not.toHaveBeenCalled();
    });

    it('rejects extra path segments after _git', () => {
      const config = {
        ...upgrade,
        sourceUrl: 'https://dev.azure.com/org/project/_git/nested/repo',
      };

      expect(changelogSource.getBaseUrl(config)).toBe('');
      expect(changelogSource.getRepositoryFromUrl(config)).toBe('');
    });

    it('rejects extra Cloud path segments before the project', () => {
      const config = {
        ...upgrade,
        sourceUrl: 'https://dev.azure.com/org/multi/level/project/_git/repo',
      };

      expect(changelogSource.getBaseUrl(config)).toBe('');
      expect(changelogSource.getRepositoryFromUrl(config)).toBe('');
    });

    it('rejects extra legacy path segments before the project', () => {
      const config = {
        ...upgrade,
        sourceUrl: 'https://org.visualstudio.com/extra/project/_git/repo',
      };

      expect(changelogSource.getBaseUrl(config)).toBe('');
      expect(changelogSource.getRepositoryFromUrl(config)).toBe('');
    });
    it('rejects malformed encoded repository names', () => {
      expect(
        changelogSource.getRepositoryFromUrl({
          ...upgrade,
          sourceUrl: `${baseUrl}_git/repo%invalid`,
        }),
      ).toBe('');
      expect(changelogSource.hasValidRepository('')).toBeFalse();
    });

    it('does not create an API URL from an invalid repository URL', () => {
      expect(
        changelogSource.getAPIBaseUrl({
          ...upgrade,
          sourceUrl: 'https://dev.azure.com/org/project',
        }),
      ).toBe('');
    });

    it('encodes decoded repository names in compare links once', () => {
      expect(
        changelogSource.getCompareURL(
          baseUrl,
          'My Repo',
          'refs/tags/1.0.0',
          'refs/tags/2.0.0',
        ),
      ).toBe(
        `${baseUrl}_git/My%20Repo/branchCompare?baseVersion=GT1.0.0&targetVersion=GT2.0.0`,
      );
    });
    it.each`
      sourceUrl                                                     | expected
      ${'https://dev.azure.com/org/My%20Project/_git/My%20Repo'}    | ${'https://dev.azure.com/org/My%20Project/'}
      ${'https://org.visualstudio.com/My%20Project/_git/My%20Repo'} | ${'https://org.visualstudio.com/My%20Project/'}
      ${'git+https://dev.azure.com/org/project/_git/repo'}          | ${'https://dev.azure.com/org/project/'}
      ${'https://dev.azure.com/org/project'}                        | ${''}
    `('extracts project base from $sourceUrl', ({ sourceUrl, expected }) => {
      expect(changelogSource.getBaseUrl({ ...upgrade, sourceUrl })).toBe(
        expected,
      );
    });

    it.each`
      encoded          | decoded
      ${'My%20Repo'}   | ${'My Repo'}
      ${'caf%C3%A9'}   | ${'café'}
      ${'repo%25name'} | ${'repo%name'}
    `('decodes repository $encoded once', ({ encoded, decoded }) => {
      expect(
        changelogSource.getRepositoryFromUrl({
          ...upgrade,
          sourceUrl: `${baseUrl}_git/${encoded}`,
        }),
      ).toBe(decoded);
      expect(
        changelogSource.getNotesSourceUrl(baseUrl, decoded, '/CHANGELOG.md'),
      ).toBe(`${baseUrl}_git/${encoded}?path=/CHANGELOG.md`);
    });

    it('passes decoded repository and project names to the SDK helpers', async () => {
      vi.spyOn(azureHelper, 'getItem')
        .mockResolvedValueOnce({ objectId: 'tree' })
        .mockResolvedValueOnce({ content: '# changelog' });
      vi.spyOn(azureHelper, 'getTrees').mockResolvedValueOnce({
        treeEntries: [
          { gitObjectType: GitObjectType.Blob, relativePath: 'CHANGELOG.md' },
        ],
      });

      await changelogSource.getReleaseNotesMd(
        'My Repo',
        'https://dev.azure.com/org/My%20Project/_apis/',
      );

      expect(azureHelper.getItem).toHaveBeenNthCalledWith(
        1,
        'My Repo',
        '/',
        'My Project',
      );
      expect(azureHelper.getTrees).toHaveBeenCalledWith(
        'My Repo',
        'tree',
        'My Project',
      );
    });
  });

  describe('getAllTags', () => {
    it('retries failed lookups and caches successful retries', async () => {
      GlobalConfig.set({ cachePrivatePackages: false });
      const getRefs = vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValueOnce([{ name: 'refs/tags/1.0.0' }]);
      vi.spyOn(azureApi, 'gitApi').mockResolvedValue(
        partial<IGitApi>({ getRefs }),
      );

      await expect(
        changelogSource.getAllTags(apiBaseUrl, 'repo'),
      ).rejects.toThrow('temporary failure');
      await expect(
        changelogSource.getAllTags(apiBaseUrl, 'repo'),
      ).resolves.toEqual(['refs/tags/1.0.0']);
      await expect(
        changelogSource.getAllTags(apiBaseUrl, 'repo'),
      ).resolves.toEqual(['refs/tags/1.0.0']);

      expect(getRefs).toHaveBeenCalledTimes(2);
    });

    it('shares in-flight tag lookups', async () => {
      GlobalConfig.set({ cachePrivatePackages: false });
      const getRefs = vi.fn().mockResolvedValue([{ name: 'refs/tags/1.0.0' }]);
      vi.spyOn(azureApi, 'gitApi').mockResolvedValue(
        partial<IGitApi>({ getRefs }),
      );

      const first = changelogSource.getAllTags(apiBaseUrl, 'repo');
      const second = changelogSource.getAllTags(apiBaseUrl, 'repo');
      await expect(Promise.all([first, second])).resolves.toEqual([
        ['refs/tags/1.0.0'],
        ['refs/tags/1.0.0'],
      ]);

      expect(getRefs).toHaveBeenCalledTimes(1);
    });

    it('uses a structured tag cache key', async () => {
      GlobalConfig.set({ cachePrivatePackages: false });
      vi.spyOn(azureApi, 'gitApi').mockResolvedValue(
        partial<IGitApi>({ getRefs: vi.fn().mockResolvedValue([]) }),
      );
      const set = vi.spyOn(memCache, 'set');

      await changelogSource.getAllTags(apiBaseUrl, 'repo:name');

      expect(set).toHaveBeenCalledWith(
        `changelog-project-tags:${JSON.stringify([apiBaseUrl, 'repo:name'])}`,
        expect.any(Promise),
      );
    });
    beforeEach(() => {
      memCache.init();
    });

    afterEach(() => {
      memCache.reset();
    });
    it('fetches private tags only once per run when shared caching is disabled', async () => {
      GlobalConfig.set({ cachePrivatePackages: false });
      const getRefs = vi.fn().mockResolvedValue([{ name: 'refs/tags/1.0.0' }]);
      vi.spyOn(azureApi, 'gitApi').mockResolvedValue(
        partial<IGitApi>({ getRefs }),
      );

      await changelogSource.getAllTags(apiBaseUrl, 'some-repo');
      await changelogSource.getAllTags(apiBaseUrl, 'some-repo');

      expect(getRefs).toHaveBeenCalledExactlyOnceWith(
        'some-repo',
        'some-project',
        'tags',
      );
    });
    it('keeps tag lookups scoped to the source project', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });
      const cache = new Map<string, unknown>();
      vi.spyOn(packageCache, 'get').mockImplementation((_namespace, key) =>
        Promise.resolve(cache.get(key)),
      );
      vi.spyOn(packageCache, 'set').mockImplementation(
        (_namespace, key, value) => {
          cache.set(key, value);
          return Promise.resolve();
        },
      );
      const getRefs = vi
        .fn()
        .mockResolvedValueOnce([{ name: 'refs/tags/1.0.0' }])
        .mockResolvedValueOnce([{ name: 'refs/tags/2.0.0' }, {}]);
      vi.spyOn(azureApi, 'gitApi').mockResolvedValue(
        partial<IGitApi>({ getRefs }),
      );

      await expect(
        changelogSource.getAllTags(
          'https://dev.azure.com/org/project-A/_apis/',
          'common',
        ),
      ).resolves.toEqual(['refs/tags/1.0.0']);
      await expect(
        changelogSource.getAllTags(
          'https://dev.azure.com/org/project-B/_apis/',
          'common',
        ),
      ).resolves.toEqual(['refs/tags/2.0.0']);
      await expect(
        changelogSource.getAllTags(
          'https://dev.azure.com/org/project-A/_apis/',
          'common',
        ),
      ).resolves.toEqual(['refs/tags/1.0.0']);
      expect(getRefs).toHaveBeenNthCalledWith(1, 'common', 'project-A', 'tags');
      expect(getRefs).toHaveBeenNthCalledWith(2, 'common', 'project-B', 'tags');
      expect(getRefs).toHaveBeenCalledTimes(2);
    });
  });

  describe('organization scope', () => {
    it('skips sources when no Azure endpoint is configured', async () => {
      vi.spyOn(azureApi, 'getEndpoint').mockReturnValue(undefined);

      await expect(
        changelogSource.getChangeLogJSON(upgrade),
      ).resolves.toBeNull();
    });
    it.each`
      endpoint                                                       | sourceUrl
      ${'https://dev.azure.com/some-org/'}                           | ${upgrade.sourceUrl}
      ${'https://dev.azure.com/SOME-ORG/'}                           | ${upgrade.sourceUrl}
      ${'https://some-org.visualstudio.com/'}                        | ${upgrade.sourceUrl}
      ${'https://dev.azure.com/some-org/'}                           | ${'https://some-org.visualstudio.com/some-project/_git/some-repo'}
      ${'https://development.some-host.org/collection/'}             | ${'https://development.some-host.org/collection/project/_git/repo'}
      ${'https://development.some-host.org/multi/level/collection/'} | ${'https://development.some-host.org/multi/level/collection/project/_git/repo'}
      ${'https://azure.example.com/'}                                | ${'https://azure.example.com/project/_git/repo'}
    `(
      'accepts sources in configured organization $endpoint',
      async ({ endpoint, sourceUrl }) => {
        azureApi.setEndpoint(endpoint);
        vi.spyOn(changelogSource, 'getAllTags').mockResolvedValue([]);
        vi.spyOn(azureHelper, 'getItem').mockResolvedValue({});

        await expect(
          changelogSource.getChangeLogJSON({ ...upgrade, sourceUrl }),
        ).resolves.not.toBeNull();
      },
    );

    it.each`
      endpoint                                           | sourceUrl
      ${'not-a-url'}                                     | ${upgrade.sourceUrl}
      ${'https://dev.azure.com/some-org/'}               | ${'not-a-url'}
      ${'https://dev.azure.com/some-org/'}               | ${'https://dev.azure.com/some-org-other/project/_git/repo'}
      ${'https://development.some-host.org/Collection/'} | ${'https://development.some-host.org/collection/project/_git/repo'}
    `(
      'skips invalid scope $endpoint / $sourceUrl',
      async ({ endpoint, sourceUrl }) => {
        azureApi.setEndpoint(endpoint);

        await expect(
          changelogSource.getChangeLogJSON({ ...upgrade, sourceUrl }),
        ).resolves.toBeNull();
      },
    );
    it('skips a source in a different organization before fetching', async () => {
      azureApi.setEndpoint('https://dev.azure.com/configured-org/');
      const getItem = vi.spyOn(azureHelper, 'getItem');
      const getAllTags = vi.spyOn(changelogSource, 'getAllTags');

      await expect(
        changelogSource.getChangeLogJSON(upgrade),
      ).resolves.toBeNull();

      expect(getItem).not.toHaveBeenCalled();
      expect(getAllTags).not.toHaveBeenCalled();
    });
  });
  describe('getReleaseList', () => {
    it('isolates notes cache keys with and without sourceDirectory', () => {
      const project = { ...azureProject, repository: 'common' };

      expect(changelogSource.getNotesCacheKey(project)).toBe(
        JSON.stringify([baseUrl, 'common', '']),
      );
      expect(
        changelogSource.getNotesCacheKey({
          ...project,
          sourceDirectory: '/docs',
        }),
      ).toBe(JSON.stringify([baseUrl, 'common', '/docs']));
    });
    it('returns empty array', async () => {
      const res = await changelogSource.getReleaseList(
        partial<ChangeLogProject>({}),
        partial<ChangeLogRelease>({}),
      );
      expect(res).toEqual([]);
    });
  });

  describe('getReleaseNotesMdFile', () => {
    it('handles release notes', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'some-other-object-id',
        content: changelogMd,
      });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toStrictEqual({
        changelogFile: '/CHANGELOG.md',
        changelogMd: `${changelogMd}\n#\n##`,
      });
    });

    it('handles release notes with sourceDirectory', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
        path: '/src/docs',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'some-other-object-id',
        content: changelogMd,
      });

      const project = {
        ...azureProject,
        sourceDirectory: '/src/docs',
      };
      const res = await getReleaseNotesMdFile(project);
      expect(res).toStrictEqual({
        changelogFile: '/src/docs/CHANGELOG.md',
        changelogMd: `${changelogMd}\n#\n##`,
      });
    });

    it('handles release notes with sourceDirectory that has trailing slash', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
        path: '/src/docs/',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'some-other-object-id',
        content: changelogMd,
      });

      const project = {
        ...azureProject,
        sourceDirectory: '/src/docs/',
      };
      const res = await getReleaseNotesMdFile(project);
      expect(res).toStrictEqual({
        changelogFile: '/src/docs/CHANGELOG.md',
        changelogMd: `${changelogMd}\n#\n##`,
      });
    });

    it('handles empty sourceDirectory', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'some-other-object-id',
        content: changelogMd,
      });

      const project = {
        ...azureProject,
        sourceDirectory: '',
      };
      const res = await getReleaseNotesMdFile(project);
      expect(res).toStrictEqual({
        changelogFile: 'CHANGELOG.md',
        changelogMd: `${changelogMd}\n#\n##`,
      });
    });

    it('handles missing items', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({});

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles missing files', async () => {
      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({
        objectId: 'some-object-id',
        path: '/',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [],
      });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles missing release notes', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Blob,
            relativePath: '.gitignore.md',
          },
        ],
      });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles missing tree blob entries', async () => {
      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({
        objectId: 'some-object-id',
        path: '/',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Tree,
            relativePath: 'some-dir',
          },
        ],
      });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles no changelog content', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
      });
      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'some-other-object-id',
        content: undefined,
      });
      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles alternate changelog file names', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'some-other-object-id',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'changelog.md',
          },
          {
            objectId: 'some-other-object-id-2',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'HISTORY.md',
          },
          {
            objectId: 'some-other-object-id-3',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'RELEASES.md',
          },
        ],
      });

      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'some-other-object-id',
        content: changelogMd,
      });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toStrictEqual({
        changelogFile: '/changelog.md',
        changelogMd: `${changelogMd}\n#\n##`,
      });
    });

    it('handles null tree entries', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
        path: '/',
      });

      // Mock getTrees to return null tree entries
      vi.spyOn(azureHelper, 'getTrees').mockResolvedValueOnce({
        objectId: 'some-object-id',
        treeEntries: [], // Null entries
      });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles various changelog filename patterns', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
        path: '/',
      });

      // Mock getTrees to return different filename patterns
      vi.spyOn(azureHelper, 'getTrees').mockResolvedValueOnce({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'id-1',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'README.md',
          },
          {
            objectId: 'id-2',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'UPDATES', // Should match
          },
          {
            objectId: 'id-3',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'docs/changes.md', // Should match
          },
          {
            objectId: 'id-4',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'NEWS.md',
          },
          {
            objectId: 'id-5',
            gitObjectType: GitObjectType.Tree,
            relativePath: 'src',
          },
          {
            objectId: 'id-6',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'LICENSE.md',
          },
        ],
      });

      // .md file is preferred over others
      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'id-3',
        content: changelogMd,
      });

      const res = await getReleaseNotesMdFile(azureProject);

      expect(res).toStrictEqual({
        changelogFile: '/docs/changes.md',
        changelogMd: `${changelogMd}\n#\n##`,
      });
    });

    it('handles filenames with no extensions or missing paths', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
        path: '/',
      });

      // Test files with missing paths or no extensions
      vi.spyOn(azureHelper, 'getTrees').mockResolvedValueOnce({
        objectId: 'some-object-id',
        treeEntries: [
          {
            objectId: 'id-1',
            gitObjectType: GitObjectType.Blob,
            relativePath: undefined, // Missing path
          },
          {
            objectId: 'id-2',
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG', // No extension but should match
          },
        ],
      });

      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'id-2',
        content: 'changelog content',
      });

      const res = await getReleaseNotesMdFile(azureProject);

      expect(res).toStrictEqual({
        changelogFile: '/CHANGELOG',
        changelogMd: `changelog content\n#\n##`,
      });
    });
  });

  describe('project extraction from API URL', () => {
    it('extracts project name from standard Azure DevOps URL', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'test-id',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        treeEntries: [
          {
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      const apiUrl =
        'https://dev.azure.com/organization/project-name/_apis/git/repositories';
      await getReleaseNotesMdFile({
        ...azureProject,
        apiBaseUrl: apiUrl,
      });

      // Check that the extracted project was passed to getItem
      expect(azureHelper.getItem).toHaveBeenCalledTimes(2);
      expect(azureHelper.getItem).toHaveBeenNthCalledWith(
        1,
        'some-repo',
        '/',
        'project-name',
      );
    });

    it('handles URL with multi-level path before _apis', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'test-id',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        treeEntries: [
          {
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      const apiUrl =
        'https://customdomain.com/org/subgroup/project/_apis/git/repositories';
      await getReleaseNotesMdFile({
        ...azureProject,
        apiBaseUrl: apiUrl,
      });

      expect(azureHelper.getItem).toHaveBeenNthCalledWith(
        1,
        'some-repo',
        '/',
        'project',
      );
    });

    it('skips SDK calls when no project is found in URL', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValue({
        objectId: 'test-id',
      });

      vi.spyOn(azureHelper, 'getTrees').mockResolvedValue({
        treeEntries: [
          {
            gitObjectType: GitObjectType.Blob,
            relativePath: 'CHANGELOG.md',
          },
        ],
      });

      const apiUrl = 'https://dev.azure.com/invalid-url-without-project/';
      const result = await getReleaseNotesMdFile({
        ...azureProject,
        apiBaseUrl: apiUrl,
      });

      expect(result).toBeNull();
      expect(azureHelper.getItem).not.toHaveBeenCalled();
    });
  });

  describe('source', () => {
    describe('getBaseUrl', () => {
      it.each`
        sourceUrl                                                                   | expected
        ${'https://development.some-host.org/some-org/some-project/_git/some-repo'} | ${'https://development.some-host.org/some-org/some-project/'}
        ${'some-random-value'}                                                      | ${''}
      `('$sourceUrl', ({ sourceUrl, expected }) => {
        expect(
          changelogSource.getBaseUrl({
            ...upgrade,
            sourceUrl,
          }),
        ).toBe(expected);
      });
    });

    it('getAPIBaseUrl', () => {
      expect(changelogSource.getAPIBaseUrl(upgrade)).toBe(apiBaseUrl);
    });

    it('getCompareURL', () => {
      const res = changelogSource.getCompareURL(
        baseUrl,
        'some-repo',
        'abc',
        'xyz',
      );
      expect(res).toBe(
        `${baseUrl}_git/some-repo/branchCompare?baseVersion=GTabc&targetVersion=GTxyz`,
      );
    });

    describe('hasValidRepository', () => {
      it('validates Azure repository names correctly', () => {
        // Valid Azure repository (single segment name)
        expect(changelogSource.hasValidRepository('some-repo')).toBe(true);

        // Invalid Azure repository (contains slashes)
        expect(changelogSource.hasValidRepository('org/some-repo')).toBe(false);
        expect(
          changelogSource.hasValidRepository('org/project/some-repo'),
        ).toBe(false);
      });
    });

    describe('getRepositoryFromUrl', () => {
      it.each<[string, string]>([
        // Format: [sourceUrl, expectedRepoName]
        ['https://dev.azure.com/org/project/_git/repo', 'repo'],
        [
          'https://dev.azure.com/org/project/_git/complex-repo-name',
          'complex-repo-name',
        ],
        ['https://dev.azure.com/org/project/_git/nested/repo', ''],
        ['https://dev.azure.com/org/multi/level/project/_git/repo', ''],
        ['https://dev.azure.com/org/project/_git/repo/', 'repo'],
        // Unparseable sourceUrl yields an empty repository
        ['some-random-value', ''],
      ])(
        'extracts repository name from Azure URLs correctly for %s',
        (sourceUrl, expectedRepo) => {
          const config = partial<BranchUpgradeConfig>({
            sourceUrl,
          });

          expect(changelogSource.getRepositoryFromUrl(config)).toBe(
            expectedRepo,
          );
        },
      );
    });
  });
});
