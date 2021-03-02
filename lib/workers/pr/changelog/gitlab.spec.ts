import * as httpMock from '../../../../test/http-mock';
import { getName } from '../../../../test/util';
import { PLATFORM_TYPE_GITLAB } from '../../../constants/platforms';
import * as hostRules from '../../../util/host-rules';
import * as semverVersioning from '../../../versioning/semver';
import type { BranchUpgradeConfig } from '../../types';
import { getChangeLogJSON } from '.';

jest.mock('../../../../lib/datasource/npm');

const upgrade: BranchUpgradeConfig = {
  branchName: undefined,
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

const baseUrl = 'https://gitlab.com/';

describe(getName(__filename), () => {
  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      httpMock.setup();
      hostRules.clear();
      hostRules.add({
        hostType: PLATFORM_TYPE_GITLAB,
        baseUrl,
        token: 'abc',
      });
    });
    afterEach(() => {
      httpMock.reset();
    });
    it('returns null if @types', async () => {
      httpMock.scope(baseUrl);
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: null,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toBeEmpty();
    });
    it('returns null if currentVersion equals newVersion', async () => {
      httpMock.scope(baseUrl);
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: '1.0.0',
          newVersion: '1.0.0',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toBeEmpty();
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
      ).toMatchSnapshot();
    });
    it('uses GitLab tags', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v4/projects/meno%2fdropzone/repository/tags?per_page=100')
        .reply(200, [
          { name: 'v5.2.0' },
          { name: 'v5.4.0' },
          { name: 'v5.5.0' },
          { name: 'v5.6.0' },
          { name: 'v5.6.1' },
          { name: 'v5.7.0' },
        ])
        .persist()
        .get('/api/v4/projects/meno%2fdropzone/repository/tree?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2fdropzone/releases?per_page=100')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles empty GitLab tags response', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v4/projects/meno%2fdropzone/repository/tags?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2fdropzone/repository/tree?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2fdropzone/releases?per_page=100')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('uses GitLab tags with error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v4/projects/meno%2fdropzone/repository/tags?per_page=100')
        .replyWithError('Unknown GitLab Repo')
        .persist()
        .get('/api/v4/projects/meno%2fdropzone/repository/tree?per_page=100')
        .reply(200, [])
        .persist()
        .get('/api/v4/projects/meno%2fdropzone/releases?per_page=100')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        hostType: PLATFORM_TYPE_GITLAB,
        baseUrl: 'https://gitlab-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitlab-enterprise.example.com/meno/dropzone/',
          endpoint: 'https://gitlab-enterprise.example.com/',
        })
      ).toMatchSnapshot();
    });
    it('supports self-hosted gitlab changelog', async () => {
      httpMock.scope('https://git.test.com').persist().get(/.*/).reply(200, []);
      hostRules.add({
        hostType: PLATFORM_TYPE_GITLAB,
        baseUrl: 'https://git.test.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          platform: PLATFORM_TYPE_GITLAB,
          sourceUrl: 'https://git.test.com/meno/dropzone/',
          endpoint: 'https://git.test.com/api/v4/',
        })
      ).toMatchSnapshot();
    });
  });
});
