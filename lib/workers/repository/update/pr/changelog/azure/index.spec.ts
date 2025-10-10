import type { ChangeLogProject } from '..';
import { getChangeLogJSON } from '..';
import * as semverVersioning from '../../../../../../modules/versioning/semver';
import type { BranchUpgradeConfig } from '../../../../../types';
import { getReleaseNotesMdFile } from '../release-notes';
import { AzureChangeLogSource } from './source';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { hostRules, partial } from '~test/util';

const baseUrl = 'https://dev.azure.com/some-org/some-project/';
const apiBaseUrl = 'https://dev.azure.com/some-org/some-project/_apis/';
const matchHost = 'https://dev.azure.com/';

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
  afterEach(() => {
    httpMock.clear(false);
  });

  describe('getChangeLogJson', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: 'azure',
        matchHost,
        token: 'some-token',
      });
    });

    it('returns null if @types', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: undefined,
        }),
      ).toBeNull();
    });

    it('returns null if currentVersion equals newVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: '1.0.0',
          newVersion: '1.0.0',
        }),
      ).toBeNull();
    });

    it('uses azure tags', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get(
          '/some-org/some-project/_apis/git/repositories/some-repo/refs?filter=tags&api-version=7.0&$top=100',
        )
        .reply(200, {
          value: [
            { name: 'refs/tags/v5.2.0' },
            { name: 'refs/tags/v5.4.0' },
            { name: 'refs/tags/v5.5.0' },
            { name: 'refs/tags/v5.6.0' },
            { name: 'refs/tags/v5.6.1' },
            { name: 'refs/tags/v5.7.0' },
          ],
        })
        .persist()
        .get(
          '/some-org/some-project/_apis/git/repositories/some-repo/items?path=/&api-version=7.0',
        )
        .reply(200, []);

      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl,
          baseUrl,
          packageName: 'renovate',
          repository: 'some-repo',
          sourceDirectory: undefined,
          sourceUrl: `https://dev.azure.com/some-org/some-project/_git/some-repo/`,
          type: 'azure',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('handles empty Azure tags response', async () => {
      httpMock
        .scope(matchHost)
        .get(
          '/some-org/some-project/_apis/git/repositories/some-repo/refs?filter=tags&$top=100&api-version=7.0',
        )
        .reply(200, {
          value: [],
        })
        .persist()
        .get(
          '/some-org//some-project/_apis/git/repositories/some-repo/items?path=/&api-version=7.0',
        )
        .reply(200, {
          value: [],
        });
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://dev.azure.com/some-org/some-project/_apis/',
          baseUrl: 'https://dev.azure.com/some-org/some-project/',
          packageName: 'renovate',
          repository: 'some-repo',
          sourceDirectory: undefined,
          sourceUrl:
            'https://dev.azure.com/some-org/some-project/_git/some-repo/',
          type: 'azure',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('uses Azure tags with error', async () => {
      httpMock
        .scope(matchHost)
        .get(
          '/some-org/some-project/_apis/git/repositories/some-repo/refs?filter=tags&$top=100&api-version=7.0',
        )
        .replyWithError('Unknown Azure DevOps Repo')
        .persist()
        .get(
          '/some-org//some-project/_apis/git/repositories/some-repo/items?path=/&api-version=7.0',
        )
        .reply(200, {
          value: [],
        });
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://dev.azure.com/some-org/some-project/_apis/',
          baseUrl: 'https://dev.azure.com/some-org/some-project/',
          packageName: 'renovate',
          repository: 'some-repo',
          sourceDirectory: undefined,
          sourceUrl:
            'https://dev.azure.com/some-org/some-project/_git/some-repo/',
          type: 'azure',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });
    it('handles no sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: undefined,
        }),
      ).toBeNull();
    });

    it('handles invalid sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'http://example.com',
        }),
      ).toBeNull();
    });

    it('handles no releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [],
        }),
      ).toBeNull();
    });

    it('handles not enough releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [{ version: '0.9.0' }],
        }),
      ).toBeNull();
    });
  });

  describe('getReleaseNotesMdFile', () => {
    it('handles release notes', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');
      // Read the changelog file as a Buffer to simulate application/octet-stream
      const changelogMdFile = Buffer.from(
        Fixtures.get('jest.md', '..'),
        'utf8',
      );

      httpMock
        .scope(apiBaseUrl)
        .get('/git/repositories/some-repo/items?path=/&api-version=7.0')
        .reply(200, {
          objectId: 'some-object-id',
          path: '/',
        })
        .get('/git/repositories/some-repo/trees/some-object-id?api-version=7.0')
        .reply(200, {
          objectId: 'some-object-id',
          treeEntries: [
            {
              objectId: 'some-other-object-id',
              gitObjectType: 'blob',
              relativePath: 'CHANGELOG.md',
            },
          ],
        })
        .get(
          '/git/repositories/some-repo/items?path=/CHANGELOG.md&includeContent=true&api-version=7.0',
        )
        .reply(200, changelogMdFile);

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toStrictEqual({
        changelogFile: '/CHANGELOG.md',
        changelogMd: changelogMd + '\n#\n##',
      });
    });

    it('handles release notes with sourceDirectory', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');
      // Read the changelog file as a Buffer to simulate application/octet-stream
      const changelogMdFile = Buffer.from(
        Fixtures.get('jest.md', '..'),
        'utf8',
      );
      httpMock
        .scope(apiBaseUrl)
        .get(
          '/git/repositories/some-repo/items?path=%2Fsrc%2Fdocs&api-version=7.0',
        )
        .reply(200, {
          objectId: 'some-object-id',
          path: '/src/docs',
        })
        .get('/git/repositories/some-repo/trees/some-object-id?api-version=7.0')
        .reply(200, {
          objectId: 'some-object-id',
          treeEntries: [
            {
              objectId: 'some-other-object-id',
              gitObjectType: 'blob',
              relativePath: 'CHANGELOG.md',
            },
          ],
        })
        .get(
          '/git/repositories/some-repo/items?path=/src/docs/CHANGELOG.md&includeContent=true&api-version=7.0',
        )
        .reply(200, changelogMdFile);

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
      httpMock
        .scope(apiBaseUrl)
        .get('/git/repositories/some-repo/items?path=%2F&api-version=7.0')
        .reply(200, {});

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles missing files', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/git/repositories/some-repo/items?path=%2F&api-version=7.0')
        .reply(200, {
          objectId: 'some-object-id',
          path: '/',
        })
        .get('/git/repositories/some-repo/trees/some-object-id?api-version=7.0')
        .reply(200, {
          objectId: 'some-object-id',
          treeEntries: [],
        });

      const res = await getReleaseNotesMdFile(azureProject);
      expect(res).toBeNull();
    });

    it('handles missing release notes', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/git/repositories/some-repo/items?path=%2F&api-version=7.0')
        .reply(200, {})
        .get('/git/repositories/some-repo/trees/some-object-id?api-version=7.0')
        .reply(200, {
          objectId: 'some-object-id',
          treeEntries: [
            {
              objectId: 'some-other-object-id',
              gitObjectType: 'blob',
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

    //'https://dev.azure.com/some-org/some-project/_apis/_apis/git/repositories/some-repo/refs?filter=tags&%24top=100&api-version=7.0'

    describe('getAllTags', () => {
      it('handles endpoint', async () => {
        httpMock
          .scope(apiBaseUrl)
          .get(
            '/git/repositories/some-repo/refs?filter=tags&%24top=100&api-version=7.0',
          )
          .reply(200, {
            value: [
              {
                name: 'v17.7.2-deno',
              },
              { name: 'v17.7.2' },
              {
                name: 'v17.7.1-deno',
              },
            ],
          });

        const res = await changelogSource.getAllTags(baseUrl, 'some-repo');
        expect(res).toEqual(['v17.7.1-deno', 'v17.7.2-deno', 'v17.7.2']);
      });
    });
  });
});
