import * as httpMock from '../../../../test/http-mock';
import { reset as memCacheReset } from '../../../util/cache/memory';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository';
import type { LongCommitSha } from '../../../util/git/types';
import { GitlabHttp, setBaseUrl } from '../../../util/http/gitlab';
import { GitlabPrCache } from './pr-cache';
import type { GitLabMergeRequest, GitlabPrCacheData } from './types';
import { prInfo } from './utils';

const http = new GitlabHttp();

const pr1: GitLabMergeRequest = {
  iid: 1,
  title: 'title',
  state: 'opened',
  source_branch: 'branch',
  target_branch: 'master',
  reviewers: [],
  updated_at: '2020-01-01T00:00:00.000Z',
  created_at: '2020-01-01T00:00:00.000Z',
  diverged_commits_count: 5,
  labels: [],
  merge_status: 'cannot_be_merged',
  description: 'a merge request',
  sha: 'defg' as LongCommitSha,
};

const pr2: GitLabMergeRequest = {
  iid: 2,
  title: 'title',
  state: 'opened',
  source_branch: 'branch',
  target_branch: 'master',
  updated_at: '2023-01-01T00:00:00.000Z',
  created_at: '2023-01-01T00:00:00.000Z',
  diverged_commits_count: 5,
  labels: [],
  merge_status: 'cannot_be_merged',
  description: 'a merge request',
  sha: 'defg' as LongCommitSha,
};

const pr3: GitLabMergeRequest = {
  iid: 3,
  title: 'title',
  state: 'opened',
  source_branch: 'branch',
  target_branch: 'master',
  updated_at: '2023-01-01T00:00:00.000Z',
  created_at: '2023-01-01T00:00:00.000Z',
  diverged_commits_count: 5,
  labels: [],
  merge_status: 'cannot_be_merged',
  description: 'a merge request',
  sha: 'defg' as LongCommitSha,
};

describe('modules/platform/gitlab/pr-cache', () => {
  let cache = getCache();

  beforeEach(() => {
    memCacheReset();
    repoCacheReset();
    cache = getCache();
    delete process.env.GITLAB_IGNORE_REPO_URL;
    setBaseUrl('https://gitlab.com/api/v4');
  });

  it('fetches cache initially', async () => {
    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc&scope=created_by_me',
      )
      .reply(200, [pr1]);

    const res = await GitlabPrCache.getPrs(http, 'repo', 'some-author', false);

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
    expect(cache.platform).toMatchObject({
      gitlab: {
        pullRequestsCache: {
          author: 'some-author',
          items: {
            '1': prInfo(pr1),
          },
          updated_at: '2020-01-01T00:00:00Z',
        },
      },
    });
  });

  it('fetches cache with ignorePrAuthor=true', async () => {
    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc',
      )
      .reply(200, [pr1]);

    const res = await GitlabPrCache.getPrs(http, 'repo', 'some-author', true);

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
  });

  it('resets cache for not matching authors', async () => {
    cache.platform = {
      gitlab: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
          },
          author: 'some-other-author',
          updated_at: '2020-01-01T00:00:00Z',
        },
      },
    };

    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc&scope=created_by_me',
      )
      .reply(200, [pr1]);

    const res = await GitlabPrCache.getPrs(http, 'repo', 'some-author', false);

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
    expect(cache.platform).toMatchObject({
      gitlab: {
        pullRequestsCache: {
          author: 'some-author',
          items: {
            '1': prInfo(pr1),
          },
          updated_at: '2020-01-01T00:00:00Z',
        },
      },
    });
  });

  it('resets cache for older format with milliseconds', async () => {
    cache.platform = {
      gitlab: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
          },
          author: 'some-author',
          updated_at: '2020-01-01T00:00:00.123Z',
        },
      },
    };

    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc&scope=created_by_me',
      )
      .reply(200, [pr1]);

    const res = await GitlabPrCache.getPrs(http, 'repo', 'some-author', false);

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
    expect(cache.platform).toMatchObject({
      gitlab: {
        pullRequestsCache: {
          author: 'some-author',
          items: {
            '1': prInfo(pr1),
          },
          updated_at: '2020-01-01T00:00:00Z',
        },
      },
    });
  });

  it('syncs cache with updated_after parameter', async () => {
    cache.platform = {
      gitlab: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
          },
          author: 'some-author',
          updated_at: '2022-01-01T00:00:00Z',
        },
      },
    };

    httpMock
      .scope('https://gitlab.com/api/v4')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc&updated_after=2022-01-01T00%3A00%3A00Z&scope=created_by_me',
      )
      .reply(200, [pr2]);

    const res = await GitlabPrCache.getPrs(http, 'repo', 'some-author', false);

    // Items are returned in reverse order by number (updateItems() calls reverse())
    expect(res).toMatchObject([
      { number: 2, title: 'title' },
      { number: 1, title: 'title' },
    ]);
    expect(cache.platform).toMatchObject({
      gitlab: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
            '2': prInfo(pr2),
          },
          author: 'some-author',
          updated_at: '2023-01-01T00:00:00Z',
        },
      },
    });
  });

  it('handles empty response', async () => {
    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc&scope=created_by_me',
      )
      .reply(200, []);

    const res = await GitlabPrCache.getPrs(http, 'repo', 'some-author', false);

    expect(res).toEqual([]);
    const prCache = cache.platform?.gitlab
      ?.pullRequestsCache as GitlabPrCacheData;
    expect(prCache.updated_at).toBeNull();
  });

  it('returns items in reverse order (most recent first)', async () => {
    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc&scope=created_by_me',
      )
      .reply(200, [pr1, pr2, pr3]);

    const res = await GitlabPrCache.getPrs(http, 'repo', 'some-author', false);

    expect(res.map((pr) => pr.number)).toEqual([3, 2, 1]);
  });

  it('normalizes timestamps by removing milliseconds', async () => {
    const prWithMilliseconds = {
      ...pr1,
      updated_at: '2020-01-01T00:00:00.123Z',
    };

    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(
        '/projects/repo/merge_requests?per_page=100&order_by=updated_at&sort=desc&scope=created_by_me',
      )
      .reply(200, [prWithMilliseconds]);

    await GitlabPrCache.getPrs(http, 'repo', 'some-author', false);

    const prCache = cache.platform?.gitlab
      ?.pullRequestsCache as GitlabPrCacheData;
    expect(prCache.updated_at).toBe('2020-01-01T00:00:00Z');
  });
});
