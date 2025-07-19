import { getChangeLogJSON } from '..';
import * as semverVersioning from '../../../../../../modules/versioning/semver';
import * as hostRules from '../../../../../../util/host-rules';
import { toBase64 } from '../../../../../../util/string';
import type { Timestamp } from '../../../../../../util/timestamp';
import type { BranchUpgradeConfig } from '../../../../../types';
import { ForgejoChangeLogSource } from '../forgejo/source';
import { getReleaseNotesMd } from '.';
import * as httpMock from '~test/http-mock';
import { partial } from '~test/util';

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  endpoint: 'https://code.forgejo.org/api/v1/',
  packageName: 'renovate',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: 'https://code.forgejo.org/meno/dropzone/',
  releases: [
    // TODO: test gitRef
    { version: '5.2.0' },
    {
      version: '5.4.0',
      releaseTimestamp: '2018-08-24T14:23:00.000Z' as Timestamp,
    },
    { version: '5.5.0', gitRef: 'eba303e91c930292198b2fc57040145682162a1b' },
    {
      version: '5.6.0',
      releaseTimestamp: '2020-02-13T15:37:00.000Z' as Timestamp,
    },
    { version: '5.6.1' },
  ],
});

const matchHost = 'https://code.forgejo.org/';

const changelogSource = new ForgejoChangeLogSource();

describe('workers/repository/update/pr/changelog/forgejo/index', () => {
  beforeAll(() => {
    // TODO: why?
    delete process.env.GITHUB_ENDPOINT;
  });

  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: 'forgejo',
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
          sourceUrl: 'https://code.forgejo.org/help',
        }),
      ).toBeNull();
    });

    it('works without forgejo', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://code.forgejo.org/api/v1/',
          baseUrl: 'https://code.forgejo.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://code.forgejo.org/meno/dropzone/',
          type: 'forgejo',
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

    it('uses forgejo tags', async () => {
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
          apiBaseUrl: 'https://code.forgejo.org/api/v1/',
          baseUrl: 'https://code.forgejo.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://code.forgejo.org/meno/dropzone/',
          type: 'forgejo',
        },
        versions: [
          {
            version: '5.6.1',
            releaseNotes: {
              body: 'some changes\n',
              name: '5.6.1 - Some feature',
              notesSourceUrl:
                'https://code.forgejo.org/api/v1/repos/meno/dropzone/releases',
              tag: 'v5.6.1',
              url: 'https://code.forgejo.org/meno/dropzone/releases/tag/v5.6.1',
            },
          },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('handles empty forgejo tags response', async () => {
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
          apiBaseUrl: 'https://code.forgejo.org/api/v1/',
          baseUrl: 'https://code.forgejo.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://code.forgejo.org/meno/dropzone/',
          type: 'forgejo',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('uses forgejo tags with error', async () => {
      httpMock
        .scope(matchHost)
        .get('/api/v1/repos/meno/dropzone/tags')
        .replyWithError('Unknown forgejo Repo')
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
          apiBaseUrl: 'https://code.forgejo.org/api/v1/',
          baseUrl: 'https://code.forgejo.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://code.forgejo.org/meno/dropzone/',
          type: 'forgejo',
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

    it('supports self-hosted forgejo changelog', async () => {
      httpMock.scope('https://git.test.com').persist().get(/.*/).reply(200, []);
      hostRules.add({
        hostType: 'forgejo',
        matchHost: 'https://git.test.com/',
        token: 'abc',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          platform: 'forgejo',
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
          type: 'forgejo',
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
            name: 'CHANGELOG',
            path: 'charts/some/CHANGELOG',
            type: 'file',
            content: null,
          },
          {
            name: 'CHANGELOG.json',
            path: 'charts/some/CHANGELOG.json',
            type: 'file',
            content: null,
          },
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
