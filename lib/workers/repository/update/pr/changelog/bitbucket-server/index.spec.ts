import { getChangeLogJSON } from '..';
import type { ChangeLogProject, ChangeLogRelease } from '..';
import { Fixtures } from '../../../../../../../test/fixtures';
import * as httpMock from '../../../../../../../test/http-mock';
import { logger, partial } from '../../../../../../../test/util';
import * as semverVersioning from '../../../../../../modules/versioning/semver';
import * as hostRules from '../../../../../../util/host-rules';
import type { BranchUpgradeConfig } from '../../../../../types';
import { getReleaseList, getReleaseNotesMdFile } from '../release-notes';
import { BitbucketServerChangeLogSource } from './source';

const baseUrl = 'https://bitbucket.some.domain.org/';
const apiBaseUrl = 'https://bitbucket.some.domain.org/rest/api/1.0/';

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  endpoint: apiBaseUrl,
  packageName: 'renovate',
  versioning: semverVersioning.id,
  currentVersion: '5.2.0',
  newVersion: '5.7.0',
  sourceUrl: `${baseUrl}projects/some-org/repos/some-repo`,
  releases: [
    { version: '5.2.0' },
    { version: '5.4.0' },
    { version: '5.5.0', gitRef: 'eba303e91c930292198b2fc57040145682162a1b' },
    { version: '5.6.0' },
    { version: '5.6.1' },
  ],
});

const bitbucketProject = partial<ChangeLogProject>({
  type: 'bitbucket-server',
  repository: 'some-org/some-repo',
  baseUrl,
  apiBaseUrl,
});

const changelogSource = new BitbucketServerChangeLogSource();

describe('workers/repository/update/pr/changelog/bitbucket-server/index', () => {
  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: 'bitbucket-server',
        matchHost: baseUrl,
        token: 'abc',
      });
    });

    it('uses bitbucket-server tags', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/tags?limit=100')
        .reply(200, {
          isLastPage: true,
          values: [
            { displayId: 'v5.2.0', hash: null },
            { displayId: 'v5.4.0', hash: null },
            {
              displayId: 'v5.5.0',
              hash: 'eba303e91c930292198b2fc57040145682162a1b',
            },
            { displayId: 'v5.6.0', hash: null },
            { displayId: 'v5.6.1', hash: null },
            { displayId: 'v5.7.0', hash: null },
          ],
        })
        .get('/projects/some-org/repos/some-repo/files?limit=100')
        .times(4)
        .reply(200, {
          isLastPage: true,
          values: ['src/CHANGELOG.md', 'CHANGELOG.md'],
        })
        .get('/projects/some-org/repos/some-repo/raw/CHANGELOG.md')
        .times(4)
        .reply(200, 'text');

      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchObject({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl,
          baseUrl,
          packageName: 'renovate',
          repository: 'some-org/some-repo',
          sourceDirectory: undefined,
          sourceUrl: `${baseUrl}projects/some-org/repos/some-repo`,
          type: 'bitbucket-server',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('handles empty bitbucket-server tags response', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/tags?limit=100')
        .reply(200, [])
        .get('/projects/some-org/repos/some-repo/files?limit=100')
        .times(4)
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
          repository: 'some-org/some-repo',
          sourceDirectory: undefined,
          sourceUrl: `${baseUrl}projects/some-org/repos/some-repo`,
          type: 'bitbucket-server',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });

    it('uses bitbucket-server tags with error', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/tags?limit=100')
        .replyWithError('Unknown bitbucket-server repo')
        .get('/projects/some-org/repos/some-repo/files?limit=100')
        .times(4)
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
          repository: 'some-org/some-repo',
          sourceDirectory: undefined,
          sourceUrl: `${baseUrl}projects/some-org/repos/some-repo`,
          type: 'bitbucket-server',
        },
        versions: [
          { version: '5.6.1' },
          { version: '5.6.0' },
          { version: '5.5.0' },
          { version: '5.4.0' },
        ],
      });
    });
  });

  describe('getReleaseNotesMdFile', () => {
    it('handles release notes', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/files?limit=100')
        .reply(200, {
          isLastPage: true,
          values: ['.gitignore', 'README.md', 'src/CHANGELOG.md'],
        })
        .get('/projects/some-org/repos/some-repo/raw/src/CHANGELOG.md')
        .reply(200, changelogMd);

      const res = await getReleaseNotesMdFile(bitbucketProject);
      expect(res).toStrictEqual({
        changelogFile: 'src/CHANGELOG.md',
        changelogMd: changelogMd + '\n#\n##',
      });
    });

    it('handles release notes with sourceDirectory', async () => {
      const changelogMd = Fixtures.get('jest.md', '..');
      httpMock
        .scope(apiBaseUrl)
        .get(
          '/projects/some-org/repos/some-repo/files/packages/components?limit=100',
        )
        .reply(200, {
          isLastPage: true,
          values: [
            '.gitignore',
            'README.md',
            'src/CHANGELOG.md',
            'src/CHANGELOG',
          ],
        })
        .get(
          '/projects/some-org/repos/some-repo/raw/packages/components/src/CHANGELOG.md',
        )
        .reply(200, changelogMd);

      const project = {
        ...bitbucketProject,
        sourceDirectory: 'packages/components',
      };
      const res = await getReleaseNotesMdFile(project);
      expect(res).toStrictEqual({
        changelogFile: 'packages/components/src/CHANGELOG.md',
        changelogMd: changelogMd + '\n#\n##',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Multiple candidates for changelog file, using packages/components/src/CHANGELOG.md`,
      );
    });

    it('handles missing release notes', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/files?limit=100')
        .reply(200, {
          isLastPage: true,
          values: ['.gitignore', 'README.md'],
        });
      expect(await getReleaseNotesMdFile(bitbucketProject)).toBeNull();
    });
  });

  it('getReleaseList', async () => {
    const res = await getReleaseList(
      bitbucketProject,
      partial<ChangeLogRelease>({}),
    );
    expect(res).toBeEmptyArray();
  });

  describe('source', () => {
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
        `${baseUrl}projects/some-org/repos/some-repo/compare/commits?sourceBranch=xyz&targetBranch=abc`,
      );
    });

    describe('getRepositoryFromUrl', () => {
      it.each`
        input                                                                                      | expected
        ${'ssh://git@some-host.org:7999/some-org/some-repo.git'}                                   | ${'some-org/some-repo'}
        ${'https://some-host.org:7990/scm/some-org/some-repo.git'}                                 | ${'some-org/some-repo'}
        ${'https://some-host:7990/projects/some-org/repos/some-repo/raw/src/CHANGELOG.md?at=HEAD'} | ${'some-org/some-repo'}
        ${'some-random-value'}                                                                     | ${''}
      `('$input', ({ input, expected }) => {
        expect(
          changelogSource.getRepositoryFromUrl({
            ...upgrade,
            sourceUrl: input,
          }),
        ).toBe(expected);
      });
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
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/tags?limit=100')
        .reply(200, {
          values: [
            {
              displayId: 'v17.7.2-deno',
              hash: '430f18aa2968b244fc91ecd9f374f62301af4b63',
            },
            { displayId: 'v17.7.2', hash: null },
            {
              displayId: 'v17.7.1-deno',
              hash: '974b64a175bf11c81bfabfeb4325c74e49204b77',
            },
          ],
        });

      const res = await changelogSource.getAllTags(
        apiBaseUrl,
        'some-org/some-repo',
      );
      expect(res).toEqual(['v17.7.1-deno', 'v17.7.2-deno', 'v17.7.2']);
    });
  });
});
