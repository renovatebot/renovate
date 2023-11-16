import { getChangeLogJSON } from '..';
import * as httpMock from '../../../../../../../test/http-mock';
import { partial } from '../../../../../../../test/util';
import * as semverVersioning from '../../../../../../modules/versioning/semver';
import * as hostRules from '../../../../../../util/host-rules';
import { toBase64 } from '../../../../../../util/string';
import type { BranchUpgradeConfig } from '../../../../../types';
import { GiteaChangeLogSource } from '../gitea/source';
import { getReleaseNotesMd } from '.';

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  endpoint: 'https://gitea.com/api/v1/',
  packageName: 'renovate',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: 'https://gitea.com/meno/dropzone/',
  releases: [
    // TODO: test gitRef
    { version: '5.2.0' },
    {
      version: '5.4.0',
      releaseTimestamp: '2018-08-24T14:23:00.000Z',
    },
    { version: '5.5.0', gitRef: 'eba303e91c930292198b2fc57040145682162a1b' },
    { version: '5.6.0', releaseTimestamp: '2020-02-13T15:37:00.000Z' },
    { version: '5.6.1' },
  ],
});

const matchHost = 'https://gitea.com/';

const changelogSource = new GiteaChangeLogSource();

describe('workers/repository/update/pr/changelog/gitea/index', () => {
  beforeAll(() => {
    // TODO: why?
    delete process.env.GITHUB_ENDPOINT;
  });

  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: 'gitea',
        matchHost,
        token: 'abc',
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

    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitea.com/help',
        }),
      ).toBeNull();
    });

    it('works without gitea', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitea.com/api/v1/',
          baseUrl: 'https://gitea.com/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitea.com/meno/dropzone/',
          type: 'gitea',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
      // TODO: find right mocks
      httpMock.clear(false);
    });

    it('uses gitea tags', async () => {
      httpMock
        .scope(matchHost)
        .get('/api/v1/repos/meno/dropzone/tags')
        .reply(200, [
          {
            name: 'v5.2.0',
            commit: { sha: 'abc', created: '2023-07-27T06:19:02Z' },
          },
          {
            name: 'v5.4.0',
            commit: { sha: 'abc', created: '2023-07-27T06:19:02Z' },
          },
          {
            name: 'v5.5.0',
            commit: { sha: 'abc', created: '2023-07-27T06:19:02Z' },
          },
          {
            name: 'v5.6.0',
            commit: { sha: 'abc', created: '2023-07-27T06:19:02Z' },
          },
          {
            name: 'v5.6.1',
            commit: { sha: 'abc', created: '2023-07-27T06:19:02Z' },
          },
          {
            name: 'v5.7.0',
            commit: { sha: 'abc', created: '2023-07-27T06:19:02Z' },
          },
        ])
        .get('/api/v1/repos/meno/dropzone/contents')
        .times(4)
        .reply(200, [])
        .get('/api/v1/repos/meno/dropzone/releases?draft=false')
        .times(4)
        .reply(200, [
          {
            name: 'v5.2.0',
            tag_name: 'v5.2.0',
            body: '',
            prerelease: false,
            published_at: '2023-07-27T06:19:02Z',
          },
          {
            name: 'v5.4.0',
            tag_name: 'v5.4.0',
            body: '',
            prerelease: false,
            published_at: '2023-07-27T06:19:02Z',
          },
          {
            name: 'v5.5.0',
            tag_name: 'v5.5.0',
            body: '',
            prerelease: false,
            published_at: '2023-07-27T06:19:02Z',
          },
          {
            name: 'v5.6.0',
            tag_name: 'v5.6.0',
            body: '',
            prerelease: false,
            published_at: '2023-07-27T06:19:02Z',
          },
          {
            name: '5.6.1 - Some feature',
            tag_name: 'v5.6.1',
            body: 'some changes',
            prerelease: false,
            published_at: '2023-07-27T06:19:02Z',
          },
          {
            name: 'v5.7.0',
            tag_name: 'v5.7.0',
            body: '',
            prerelease: false,
            published_at: '2023-07-27T06:19:02Z',
          },
        ]);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://gitea.com/api/v1/',
          baseUrl: 'https://gitea.com/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitea.com/meno/dropzone/',
          type: 'gitea',
        },
        versions: [
          {
            version: '5.6.1',
            releaseNotes: {
              body: 'some changes\n',
              name: '5.6.1 - Some feature',
              notesSourceUrl:
                'https://gitea.com/api/v1/repos/meno/dropzone/releases',
              tag: 'v5.6.1',
              url: 'https://gitea.com/meno/dropzone/releases/tag/v5.6.1',
            },
          },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('handles empty gitea tags response', async () => {
      httpMock
        .scope(matchHost)
        .get('/api/v1/repos/meno/dropzone/tags')
        .reply(200, [])
        .get('/api/v1/repos/meno/dropzone/contents')
        .times(4)
        .reply(200, [])
        .get('/api/v1/repos/meno/dropzone/releases?draft=false')
        .times(4)
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitea.com/api/v1/',
          baseUrl: 'https://gitea.com/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitea.com/meno/dropzone/',
          type: 'gitea',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('uses gitea tags with error', async () => {
      httpMock
        .scope(matchHost)
        .get('/api/v1/repos/meno/dropzone/tags')
        .replyWithError('Unknown gitea Repo')
        .get('/api/v1/repos/meno/dropzone/contents')
        .times(4)
        .reply(200, [])
        .get('/api/v1/repos/meno/dropzone/releases?draft=false')
        .times(4)
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitea.com/api/v1/',
          baseUrl: 'https://gitea.com/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitea.com/meno/dropzone/',
          type: 'gitea',
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

    it('supports gitea enterprise and gitea enterprise changelog', async () => {
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'https://gitea-enterprise.example.com/',
        token: 'abc',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitea-enterprise.example.com/meno/dropzone/',
          endpoint: 'https://gitea-enterprise.example.com/',
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitea-enterprise.example.com/api/v1/',
          baseUrl: 'https://gitea-enterprise.example.com/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitea-enterprise.example.com/meno/dropzone/',
          type: 'gitea',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });

      // TODO: find right mocks
      httpMock.clear(false);
    });

    it('supports self-hosted gitea changelog', async () => {
      httpMock.scope('https://git.test.com').persist().get(/.*/).reply(200, []);
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'https://git.test.com/',
        token: 'abc',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          platform: 'gitea',
          sourceUrl: 'https://git.test.com/meno/dropzone/',
          endpoint: 'https://git.test.com/api/v1/',
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://git.test.com/api/v1/',
          baseUrl: 'https://git.test.com/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://git.test.com/meno/dropzone/',
          type: 'gitea',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });

      // TODO: find right mocks
      httpMock.clear(false);
    });

    it('supports overwriting sourceUrl for self-hosted gitea changelog', async () => {
      httpMock.scope('https://git.test.com').persist().get(/.*/).reply(200, []);
      const sourceUrl = 'https://git.test.com/meno/dropzone/';
      const replacementSourceUrl =
        'https://git.test.com/replacement/sourceurl/';
      const config = {
        ...upgrade,
        platform: 'gitea',
        endpoint: 'https://git.test.com/api/v1/',
        sourceUrl,
        customChangelogUrl: replacementSourceUrl,
      };
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'https://git.test.com/',
        token: 'abc',
      });
      expect(await getChangeLogJSON(config)).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://git.test.com/api/v1/',
          baseUrl: 'https://git.test.com/',
          packageName: 'renovate',
          repository: 'replacement/sourceurl',
          sourceDirectory: undefined,
          sourceUrl: 'https://git.test.com/replacement/sourceurl/',
          type: 'gitea',
        },
      });
      expect(config.sourceUrl).toBe(sourceUrl); // ensure unmodified function argument

      // TODO: find right mocks
      httpMock.clear(false);
    });
  });

  describe('hasValidRepository', () => {
    it('handles invalid repository', () => {
      expect(changelogSource.hasValidRepository('foo')).toBeFalse();
      expect(changelogSource.hasValidRepository('some/repo/name')).toBeFalse();
    });

    it('handles valid repository', () => {
      expect(changelogSource.hasValidRepository('some/repo')).toBeTrue();
    });
  });

  describe('getAllTags', () => {
    it('handles endpoint', async () => {
      httpMock
        .scope('https://git.test.com/')
        .get('/api/v1/repos/some/repo/tags')
        .reply(200, [
          { name: 'v5.2.0' },
          { name: 'v5.4.0' },
          { name: 'v5.5.0' },
        ]);
      expect(
        await changelogSource.getAllTags('https://git.test.com/', 'some/repo'),
      ).toEqual([]);
    });
  });

  describe('getReleaseNotesMd', () => {
    it('works', async () => {
      httpMock
        .scope('https://git.test.com/')
        .get('/api/v1/repos/some/repo/contents/charts/some')
        .reply(200, [
          {
            name: 'CHANGELOG.md',
            path: 'charts/some/CHANGELOG.md',
            type: 'file',
            content: null,
          },
        ])
        .get('/api/v1/repos/some/repo/contents/charts/some/CHANGELOG.md')
        .reply(200, {
          name: 'CHANGELOG.md',
          path: 'charts/some/CHANGELOG.md',
          type: 'file',
          content: toBase64('some content'),
        });
      expect(
        await getReleaseNotesMd(
          'some/repo',
          'https://git.test.com/api/v1/',
          'charts/some',
        ),
      ).toEqual({
        changelogFile: 'charts/some/CHANGELOG.md',
        changelogMd: 'some content\n#\n##',
      });
    });
  });
});
