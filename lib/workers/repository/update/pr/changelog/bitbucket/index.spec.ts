import type { ChangeLogProject, ChangeLogRelease } from '..';
import { Fixtures } from '../../../../../../../test/fixtures';
import * as httpMock from '../../../../../../../test/http-mock';
import { partial } from '../../../../../../../test/util';
import type { BranchUpgradeConfig } from '../../../../../types';
import { getReleaseList, getReleaseNotesMdFile } from '../release-notes';
import { BitbucketChangeLogSource } from './source';

const baseUrl = 'https://bitbucket.org/';
const apiBaseUrl = 'https://api.bitbucket.org/';

const changelogMd = Fixtures.get('jest.md', '../..');

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  packageName: 'some-repo',
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
  repository: 'some-org/some-repo',
  baseUrl,
  apiBaseUrl,
});

describe('workers/repository/update/pr/changelog/bitbucket/index', () => {
  it('handles release notes', async () => {
    httpMock
      .scope(apiBaseUrl)
      .get('/2.0/repositories/some-org/some-repo/src?pagelen=100')
      .reply(200, bitbucketTreeResponse)
      .get('/2.0/repositories/some-org/some-repo/src/abcd/CHANGELOG.md')
      .reply(200, changelogMd);
    const res = await getReleaseNotesMdFile(bitbucketProject);

    expect(res).toMatchObject({
      changelogFile: 'CHANGELOG.md',
      changelogMd: changelogMd + '\n#\n##',
    });
  });

  it('handles missing release notes', async () => {
    httpMock
      .scope(apiBaseUrl)
      .get('/2.0/repositories/some-org/some-repo/src?pagelen=100')
      .reply(200, bitbucketTreeResponseNoChangelogFiles);
    const res = await getReleaseNotesMdFile(bitbucketProject);
    expect(res).toBeNull();
  });

  it('handles release list', async () => {
    const res = await getReleaseList(
      bitbucketProject,
      partial<ChangeLogRelease>({}),
    );
    expect(res).toBeEmptyArray();
  });

  describe('source', () => {
    it('returns api base url', () => {
      const source = new BitbucketChangeLogSource();
      expect(source.getAPIBaseUrl(upgrade)).toBe(apiBaseUrl);
    });

    it('returns get ref comparison url', () => {
      const source = new BitbucketChangeLogSource();
      expect(
        source.getCompareURL(baseUrl, 'some-org/some-repo', 'abc', 'xzy'),
      ).toBe(
        'https://bitbucket.org/some-org/some-repo/branches/compare/xzy%0Dabc',
      );
    });
  });
});
