import { ChangeLogProject, ChangeLogRelease, getChangeLogJSON } from '..';
import { Fixtures } from '../../../../../../../test/fixtures';
import * as httpMock from '../../../../../../../test/http-mock';
import { mocked, partial } from '../../../../../../../test/util';
import * as semverVersioning from '../../../../../../modules/versioning/semver';
import * as _hostRules from '../../../../../../util/host-rules';
import type { BranchUpgradeConfig } from '../../../../../types';
import { getReleaseNotesMd } from '../release-notes';

jest.mock('../../../../../../modules/datasource/npm');
jest.mock('../../../../../../util/host-rules');

const hostRules = mocked(_hostRules);

const changelogMd = Fixtures.get('gitter-webapp.md', '../..');

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

const bitbucketTreeResponse = {
  values: [
    {
      type: 'commit_directory',
      path: 'lib',
      commit: {
        hash: '1234',
      },
    },
    {
      type: 'commit_file',
      path: 'CHANGELOG.md',
      commit: {
        hash: 'abcd',
      },
    },
    {
      type: 'commit_file',
      path: 'RELEASE_NOTES.md',
      commit: {
        hash: 'asdf',
      },
    },
  ],
};

const bitbucketTreeResponseNoChangelogFiles = {
  values: [
    {
      type: 'commit_directory',
      path: 'lib',
      commit: {
        hash: '1234',
      },
    },
  ],
};

const bitbucketProject = partial<ChangeLogProject>({
  type: 'bitbucket',
  apiBaseUrl: 'https://api.bitbucket.org',
  baseUrl: 'https://bitbucket.org/',
});

describe('workers/repository/update/pr/changelog/bitbucket/index', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  it('retrieves changelog json', async () => {
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

  it('generates release notes', async () => {
    hostRules.find.mockReturnValue({ token: 'some-token' });
    httpMock
      .scope('https://api.bitbucket.org/')
      .get('/2.0/repositories/some-org/some-repo/src?pagelen=100')
      .reply(200, bitbucketTreeResponse)
      .get('/2.0/repositories/some-org/some-repo/src/abcd/CHANGELOG.md')
      .reply(200, changelogMd);
    const res = await getReleaseNotesMd(
      {
        ...bitbucketProject,
        repository: 'some-org/some-repo',
        apiBaseUrl: 'https://api.bitbucket.org/',
        baseUrl: 'https://bitbucket.org/',
      },
      partial<ChangeLogRelease>({
        version: '20.26.0',
        gitRef: '20.26.0',
      })
    );

    expect(res).toMatchObject({
      notesSourceUrl:
        'https://bitbucket.org/some-org/some-repo/blob/HEAD/CHANGELOG.md',
      url: 'https://bitbucket.org/some-org/some-repo/blob/HEAD/CHANGELOG.md#20260---2020-05-18',
    });
  });

  it('handles not found', async () => {
    httpMock
      .scope('https://api.bitbucket.org/')
      .get('/2.0/repositories/some-org/some-repo/src?pagelen=100')
      .reply(200, bitbucketTreeResponseNoChangelogFiles);
    const res = await getReleaseNotesMd(
      {
        ...bitbucketProject,
        repository: 'some-org/some-repo',
      },
      partial<ChangeLogRelease>({
        version: '2.0.0',
        gitRef: '2.0.0',
      })
    );
    expect(res).toBeNull();
  });
});
