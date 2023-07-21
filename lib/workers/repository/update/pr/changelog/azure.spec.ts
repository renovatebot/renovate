import * as httpMock from '../../../../../../test/http-mock';
import * as semverVersioning from '../../../../../modules/versioning/semver';
import * as hostRules from '../../../../../util/host-rules';
import type { BranchUpgradeConfig } from '../../../../types';
import { getChangeLogJSON } from '.';

jest.mock('../../../../../modules/datasource');

const upgrade = {
  manager: 'some-manager',
  branchName: '',
  endpoint: 'https://dev.azure.com/some-org/some-project/_apis/',
  depName: 'renovate',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: 'https://dev.azure.com/some-org/some-project/_git/some-repo/',
  releases: [
    { version: '5.2.0' },
    {
      version: '5.4.0',
      releaseTimestamp: '2018-08-24T14:23:00.000Z',
    },
    { version: '5.5.0', gitRef: 'eba303e91c930292198b2fc57040145682162a1b' },
    { version: '5.6.0', releaseTimestamp: '2020-02-13T15:37:00.000Z' },
    { version: '5.6.1' },
  ],
} satisfies BranchUpgradeConfig;

const matchHost = 'https://dev.azure.com/';

describe('workers/repository/update/pr/changelog/azure', () => {
  afterEach(() => {
    httpMock.clear(false);
  });

  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: 'azure',
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
          sourceUrl: 'https://dev.azure.com/help',
        })
      ).toBeNull();
    });

    it('works without Azure', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchObject({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://dev.azure.com/some-org/some-project/_apis/',
          baseUrl: 'https://dev.azure.com/some-org/some-project/',
          depName: 'renovate',
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

    it('uses Azure tags', async () => {
      httpMock
        .scope(matchHost)
        .get(
          '/some-org/some-project/_apis/git/repositories/some-repo/refs?filter=tags&$top=100&api-version=7.0'
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
          '/some-org//some-project/_apis/git/repositories/some-repo/items?path=/&api-version=7.0'
        )
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchObject({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://dev.azure.com/some-org/some-project/_apis/',
          baseUrl: 'https://dev.azure.com/some-org/some-project/',
          depName: 'renovate',
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

    it('handles empty Azure tags response', async () => {
      httpMock
        .scope(matchHost)
        .get(
          '/some-org/some-project/_apis/git/repositories/some-repo/refs?filter=tags&$top=100&api-version=7.0'
        )
        .reply(200, {
          value: [],
        })
        .persist()
        .get(
          '/some-org//some-project/_apis/git/repositories/some-repo/items?path=/&api-version=7.0'
        )
        .reply(200, {
          value: [],
        });
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://dev.azure.com/some-org/some-project/_apis/',
          baseUrl: 'https://dev.azure.com/some-org/some-project/',
          depName: 'renovate',
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
          '/some-org/some-project/_apis/git/repositories/some-repo/refs?filter=tags&$top=100&api-version=7.0'
        )
        .replyWithError('Unknown Azure DevOps Repo')
        .persist()
        .get(
          '/some-org//some-project/_apis/git/repositories/some-repo/items?path=/&api-version=7.0'
        )
        .reply(200, {
          value: [],
        });
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://dev.azure.com/some-org/some-project/_apis/',
          baseUrl: 'https://dev.azure.com/some-org/some-project/',
          depName: 'renovate',
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
  });
});
