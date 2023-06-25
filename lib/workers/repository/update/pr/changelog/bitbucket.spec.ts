import * as httpMock from '../../../../../../test/http-mock';
import { partial } from '../../../../../../test/util';
import * as semverVersioning from '../../../../../modules/versioning/semver';
import type { BranchUpgradeConfig } from '../../../../types';
import { getChangeLogJSON } from '.';

jest.mock('../../../../../modules/datasource/npm');

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  endpoint: 'https://api.bitbucket.org/',
  packageName: 'some-repo',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: 'https://bitbucket.org/some-org/some-repo',
  releases: [
    { version: '5.2.0' },
    {
      version: '5.4.0',
      releaseTimestamp: '2018-08-24T14:23:00.000Z',
    },
    { version: '5.5.0', gitRef: 'abcd' },
    {
      version: '5.6.0',
      gitRef: '1234',
      releaseTimestamp: '2020-02-13T15:37:00.000Z',
    },
    { version: '5.6.1', gitRef: 'asdf' },
  ],
});

describe('workers/repository/update/pr/changelog/bitbucket', () => {
  afterEach(() => {
    // FIXME: add missing http mocks
    httpMock.clear(false);
  });

  it('works with Bitbucket', async () => {
    expect(
      await getChangeLogJSON({
        ...upgrade,
      })
    ).toEqual({
      hasReleaseNotes: true,
      project: {
        apiBaseUrl: 'https://api.bitbucket.org/',
        baseUrl: 'https://bitbucket.org/',
        packageName: 'some-repo',
        repository: 'some-org/some-repo',
        sourceDirectory: undefined,
        sourceUrl: 'https://bitbucket.org/some-org/some-repo',
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
});
