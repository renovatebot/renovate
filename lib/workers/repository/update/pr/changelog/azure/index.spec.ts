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
  });
});
