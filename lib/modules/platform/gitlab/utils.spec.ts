import type { Stats } from 'node:fs';
import { partial } from '~test/util.ts';
import * as _fs from '../../../util/fs/index.ts';
import type { HttpResponse } from '../../../util/http/types.ts';
import type { RepoResponse } from './types.ts';
import { defaults, getRepoUrl, requiresGitCommit } from './utils.ts';

vi.mock('../../../util/fs/index.ts');
const fs = vi.mocked(_fs);

function makeRes(
  overrides: Partial<RepoResponse> = {},
): HttpResponse<RepoResponse> {
  return {
    statusCode: 200,
    headers: {},
    body: {
      id: 1,
      archived: false,
      mirror: false,
      default_branch: 'main',
      empty_repo: false,
      ssh_url_to_repo: null,
      http_url_to_repo: null,
      forked_from_project: false,
      repository_access_level: 'enabled',
      merge_requests_access_level: 'enabled',
      merge_method: 'merge',
      path_with_namespace: 'group/repo',
      ...overrides,
    },
  };
}

describe('modules/platform/gitlab/utils', () => {
  describe('getRepoUrl()', () => {
    let savedEndpoint: string;

    beforeEach(() => {
      savedEndpoint = defaults.endpoint;
      defaults.endpoint = 'not-a-valid-url';
    });

    afterEach(() => {
      defaults.endpoint = savedEndpoint;
    });

    it('throws on invalid endpoint when gitUrl is endpoint', () => {
      expect(() => getRepoUrl('group/repo', 'endpoint', makeRes())).toThrow(
        'Invalid GitLab endpoint: not-a-valid-url',
      );
    });

    it('throws on invalid endpoint when http_url_to_repo is null', () => {
      expect(() =>
        getRepoUrl(
          'group/repo',
          undefined,
          makeRes({ http_url_to_repo: null }),
        ),
      ).toThrow('Invalid GitLab endpoint: not-a-valid-url');
    });
  });

  describe('requiresGitCommit()', () => {
    function stats(isDirectory: boolean): Stats {
      return partial<Stats>({ isDirectory: () => isDirectory });
    }

    it('returns false for regular additions and deletions', async () => {
      await expect(
        requiresGitCommit([
          { type: 'addition', path: 'a.txt', contents: 'a' },
          { type: 'addition', path: 'b.txt', contents: null },
          { type: 'deletion', path: 'c.txt' },
        ]),
      ).resolves.toBeFalse();
      expect(fs.statLocalFile).not.toHaveBeenCalled();
    });

    it('returns true for symlinks', async () => {
      await expect(
        requiresGitCommit([
          {
            type: 'addition',
            path: 'link',
            contents: 'target',
            isSymlink: true,
          },
        ]),
      ).resolves.toBeTrue();
    });

    it('returns true for submodule updates', async () => {
      fs.statLocalFile.mockResolvedValueOnce(stats(true));

      await expect(
        requiresGitCommit([{ type: 'addition', path: 'sub', contents: '' }]),
      ).resolves.toBeTrue();
      expect(fs.statLocalFile).toHaveBeenCalledWith('sub');
    });

    it('returns false for empty regular files', async () => {
      fs.statLocalFile
        .mockResolvedValueOnce(stats(false))
        .mockResolvedValueOnce(null);

      await expect(
        requiresGitCommit([
          { type: 'addition', path: 'empty.txt', contents: '' },
          { type: 'addition', path: 'new-empty.txt', contents: '' },
        ]),
      ).resolves.toBeFalse();
    });
  });
});
