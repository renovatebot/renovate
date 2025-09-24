import { GitObjectType } from 'azure-devops-node-api/interfaces/GitInterfaces';
import type { ChangeLogProject } from '..';
import * as azureHelper from '../../../../../../modules/platform/azure/azure-helper';
import * as semverVersioning from '../../../../../../modules/versioning/semver';
import type { BranchUpgradeConfig } from '../../../../../types';
import { getReleaseNotesMdFile } from '../release-notes';
import { AzureChangeLogSource } from './source';
import { Fixtures } from '~test/fixtures';
import { partial } from '~test/util';

const baseUrl = 'https://dev.azure.com/some-org/some-project/';
const apiBaseUrl = 'https://dev.azure.com/some-org/some-project/_apis/';

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  endpoint: apiBaseUrl,
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

const azureProject = partial<ChangeLogProject>({
  type: 'azure',
  repository: 'some-repo',
  baseUrl,
  apiBaseUrl,
});

describe('workers/repository/update/pr/changelog/azure/index', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getReleaseNotesMdFile', () => {
    it('handles release notes', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({
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
        changelogMd: changelogMd + '\n#\n##',
      });
    });

    it('handles release notes with sourceDirectory', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({
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
        changelogMd: changelogMd + '\n#\n##',
      });
    });

    it('handles release notes with sourceDirectory that has trailing slash', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');

      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({
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
        changelogMd: changelogMd + '\n#\n##',
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
      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({});

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
      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({
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

      vi.spyOn(azureHelper, 'getItem').mockRejectedValue({
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
        changelogMd: changelogMd + '\n#\n##',
      });
    });

    it('handles empty tree entries', async () => {
      vi.spyOn(azureHelper, 'getItem').mockResolvedValueOnce({
        objectId: 'some-object-id',
        path: '/',
      });

      // Mock getTrees to return an empty tree or a tree with no entries
      vi.spyOn(azureHelper, 'getTrees').mockResolvedValueOnce({
        objectId: 'some-object-id',
        treeEntries: [], // Empty array of files
      });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
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
        changelogMd: changelogMd + '\n#\n##',
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
        changelogMd: 'changelog content\n#\n##',
      });
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
        'some-org/some-repo',
        'abc',
        'xyz',
      );
      expect(res).toBe(
        `${baseUrl}_git/some-org/some-repo/branchCompare?baseVersion=GTabc&targetVersion=GTxyz`,
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
      it('extracts repository name from Azure URLs correctly', () => {
        const testCases = [
          // Format: [sourceUrl, expectedRepoName]
          ['https://dev.azure.com/org/project/_git/repo', 'repo'],
          [
            'https://dev.azure.com/org/project/_git/complex-repo-name',
            'complex-repo-name',
          ],
          ['https://dev.azure.com/org/project/_git/nested/repo', 'repo'],
          ['https://dev.azure.com/org/multi/level/project/_git/repo', 'repo'],
          ['https://dev.azure.com/org/project/_git/repo/', 'repo'],
        ];

        for (const [sourceUrl, expectedRepo] of testCases) {
          const config = partial<BranchUpgradeConfig>({
            sourceUrl,
          });

          expect(changelogSource.getRepositoryFromUrl(config)).toBe(
            expectedRepo,
          );
        }
      });
    });
  });
});
