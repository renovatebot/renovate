import * as httpMock from '../../../../../../test/http-mock';
import { partial } from '../../../../../../test/util';
import * as semverVersioning from '../../../../../modules/versioning/semver';
import * as hostRules from '../../../../../util/host-rules';
import type { BranchUpgradeConfig } from '../../../../types';
import { getChangeLogJSON } from '.';

jest.mock('../../../../../modules/datasource/npm');

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  endpoint: 'https://api.bitbucket.org/',
  packageName: 'renovate',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: 'https://bitbucket.org/meno/dropzone/',
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

const matchHost = 'https://bitbucket.org/';

describe('workers/repository/update/pr/changelog/bitbucket', () => {
  afterEach(() => {
    // FIXME: add missing http mocks
    httpMock.clear(false);
  });

  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: 'bitbucket',
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
          sourceUrl: 'https://bitbucket.org/help',
        })
      ).toBeNull();
    });

    it('works with Bitbucket', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toEqual({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://api.bitbucket.org/2.0/repositories/',
          baseUrl: 'https://bitbucket.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://bitbucket.org/meno/dropzone/',
          type: 'bitbucket',
        },
        versions: [
          expect.objectContaining({ version: '5.6.1' }),
          expect.objectContaining({ version: '5.6.0' }),
          expect.objectContaining({ version: '5.5.0' }),
          expect.objectContaining({ version: '5.4.0' }),
        ],
      });
    });

    it('uses Bitbucket tags', async () => {
      httpMock
        .scope(matchHost)
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, [
          { name: 'v5.2.0' },
          { name: 'v5.4.0' },
          { name: 'v5.5.0' },
          { name: 'v5.6.0' },
          { name: 'v5.6.1' },
          { name: 'v5.7.0' },
        ])
        .persist()
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, [])
        .persist()
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toEqual({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://api.bitbucket.org/2.0/repositories/',
          baseUrl: 'https://bitbucket.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://bitbucket.org/meno/dropzone/',
          type: 'bitbucket',
        },
        versions: [
          expect.objectContaining({ version: '5.6.1' }),
          expect.objectContaining({ version: '5.6.0' }),
          expect.objectContaining({ version: '5.5.0' }),
          expect.objectContaining({ version: '5.4.0' }),
        ],
      });
    });

    it('handles empty Bitbucket tags response', async () => {
      httpMock
        .scope(matchHost)
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, [])
        .persist()
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, [])
        .persist()
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toEqual({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://api.bitbucket.org/2.0/repositories/',
          baseUrl: 'https://bitbucket.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://bitbucket.org/meno/dropzone/',
          type: 'bitbucket',
        },
        versions: [
          expect.objectContaining({ version: '5.6.1' }),
          expect.objectContaining({ version: '5.6.0' }),
          expect.objectContaining({ version: '5.5.0' }),
          expect.objectContaining({ version: '5.4.0' }),
        ],
      });
    });

    it('uses Bitbucket tags with error', async () => {
      httpMock
        .scope(matchHost)
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .replyWithError('Unknown Bitbucket Repo')
        .persist()
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, [])
        .persist()
        .get('/2.0/repositories//meno%2Fdropzone/refs/tags')
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toEqual({
        hasReleaseNotes: false,
        project: {
          apiBaseUrl: 'https://api.bitbucket.org/2.0/repositories/',
          baseUrl: 'https://bitbucket.org/',
          packageName: 'renovate',
          repository: 'meno/dropzone',
          sourceDirectory: undefined,
          sourceUrl: 'https://bitbucket.org/meno/dropzone/',
          type: 'bitbucket',
        },
        versions: [
          expect.objectContaining({ version: '5.6.1' }),
          expect.objectContaining({ version: '5.6.0' }),
          expect.objectContaining({ version: '5.5.0' }),
          expect.objectContaining({ version: '5.4.0' }),
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
