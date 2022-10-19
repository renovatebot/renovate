import * as httpMock from '../../../../../../test/http-mock';
import { PlatformId } from '../../../../../constants';
import * as semverVersioning from '../../../../../modules/versioning/semver';
import * as hostRules from '../../../../../util/host-rules';
import type { BranchUpgradeConfig } from '../../../../types';
import { getChangeLogJSON } from '.';

jest.mock('../../../../../modules/datasource/npm');

const upgrade: BranchUpgradeConfig = {
  manager: 'some-manager',
  branchName: '',
  endpoint: 'https://gitlab.com/api/v4/ ',
  depName: 'renovate',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: 'https://gitlab.com/meno/dropzone/',
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
};

const matchHost = 'https://gitlab.com/';

describe('workers/repository/update/pr/changelog/gitlab', () => {
  afterEach(() => {
    // FIXME: add missing http mocks
    httpMock.clear(false);
  });

  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: PlatformId.Gitlab,
        matchHost,
        token: 'abc',
      });
    });

    it('returns null if @types', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: undefined,
        })
      ).toBeNull();
    });

    it('returns null if currentVersion equals newVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: '1.0.0',
          newVersion: '1.0.0',
        })
      ).toBeNull();
    });

    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitlab.com/help',
        })
      ).toBeNull();
    });

    it('works without GitLab', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitlab.com/api/v4/',
          baseUrl: 'https://gitlab.com/',
          depName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitlab.com/meno/dropzone/',
          type: 'gitlab',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('uses GitLab tags', async () => {
      httpMock
        .scope(matchHost)
        .get('/api/v4/projects/meno%2Fdropzone/repository/tags?per_page=100')
        .reply(200, [
          { name: 'v5.2.0' },
          { name: 'v5.4.0' },
          { name: 'v5.5.0' },
          { name: 'v5.6.0' },
          { name: 'v5.6.1' },
          { name: 'v5.7.0' },
        ])
        .persist()
        .get('/api/v4/projects/meno%2Fdropzone/repository/tree?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2Fdropzone/releases?per_page=100')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://gitlab.com/api/v4/',
          baseUrl: 'https://gitlab.com/',
          depName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitlab.com/meno/dropzone/',
          type: 'gitlab',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('handles empty GitLab tags response', async () => {
      httpMock
        .scope(matchHost)
        .get('/api/v4/projects/meno%2Fdropzone/repository/tags?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2Fdropzone/repository/tree?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2Fdropzone/releases?per_page=100')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitlab.com/api/v4/',
          baseUrl: 'https://gitlab.com/',
          depName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitlab.com/meno/dropzone/',
          type: 'gitlab',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('uses GitLab tags with error', async () => {
      httpMock
        .scope(matchHost)
        .get('/api/v4/projects/meno%2Fdropzone/repository/tags?per_page=100')
        .replyWithError('Unknown GitLab Repo')
        .persist()
        .get('/api/v4/projects/meno%2Fdropzone/repository/tree?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2Fdropzone/releases?per_page=100')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitlab.com/api/v4/',
          baseUrl: 'https://gitlab.com/',
          depName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitlab.com/meno/dropzone/',
          type: 'gitlab',
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
        })
      ).toBeNull();
    });

    it('handles invalid sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'http://example.com',
        })
      ).toBeNull();
    });

    it('handles no releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [],
        })
      ).toBeNull();
    });

    it('handles not enough releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [{ version: '0.9.0' }],
        })
      ).toBeNull();
    });

    it('supports gitlab enterprise and gitlab enterprise changelog', async () => {
      hostRules.add({
        hostType: PlatformId.Gitlab,
        matchHost: 'https://gitlab-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitlab-enterprise.example.com/meno/dropzone/',
          endpoint: 'https://gitlab-enterprise.example.com/',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://gitlab-enterprise.example.com/api/v4/',
          baseUrl: 'https://gitlab-enterprise.example.com/',
          depName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://gitlab-enterprise.example.com/meno/dropzone/',
          type: 'gitlab',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('supports self-hosted gitlab changelog', async () => {
      httpMock.scope('https://git.test.com').persist().get(/.*/).reply(200, []);
      hostRules.add({
        hostType: PlatformId.Gitlab,
        matchHost: 'https://git.test.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          platform: PlatformId.Gitlab,
          sourceUrl: 'https://git.test.com/meno/dropzone/',
          endpoint: 'https://git.test.com/api/v4/',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://git.test.com/api/v4/',
          baseUrl: 'https://git.test.com/',
          depName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://git.test.com/meno/dropzone/',
          type: 'gitlab',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('supports overwriting sourceUrl for self-hosted gitlab changelog', async () => {
      httpMock.scope('https://git.test.com').persist().get(/.*/).reply(200, []);
      const sourceUrl = 'https://git.test.com/meno/dropzone/';
      const replacementSourceUrl =
        'https://git.test.com/replacement/sourceurl/';
      const config = {
        ...upgrade,
        platform: PlatformId.Gitlab,
        endpoint: 'https://git.test.com/api/v4/',
        sourceUrl,
        customChangelogUrl: replacementSourceUrl,
      };
      hostRules.add({
        hostType: PlatformId.Gitlab,
        matchHost: 'https://git.test.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(await getChangeLogJSON(config)).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://git.test.com/api/v4/',
          baseUrl: 'https://git.test.com/',
          depName: 'renovate',
          repository: 'replacement/sourceurl',
          sourceDirectory: undefined,
          sourceUrl: 'https://git.test.com/replacement/sourceurl/',
          type: 'gitlab',
        },
      });
      expect(config.sourceUrl).toBe(sourceUrl); // ensure unmodified function argument
    });
  });
});
