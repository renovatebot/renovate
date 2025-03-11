import * as httpMock from '../../../../test/http-mock';
import { reset as memCacheReset } from '../../../util/cache/memory';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository';
import type { LongCommitSha } from '../../../util/git/types';
import { GitlabHttp } from '../../../util/http/gitlab';
import { GitlabPrCache } from './pr-cache';
import type { GitLabMergeRequest } from './types';
import { prInfo } from './utils';

const http = new GitlabHttp();
const ignorePrAuthor = false;

const pr1: GitLabMergeRequest = {
  iid: 1,
  title: 'title',
  state: 'opened',
  source_branch: 'branch',
  target_branch: 'master',
  reviewers: [],
  updated_at: '2020-01-01T00:00:00.000Z',
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
  });

  it('fetches cache', async () => {
    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get('/projects/repo/merge_requests?per_page=100&scope=created_by_me')
      .reply(200, [pr1]);

    const res = await GitlabPrCache.getPrs(
      http,
      'repo',
      'some-author',
      ignorePrAuthor,
    );

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
    expect(cache).toEqual({
      httpCache: expect.toBeNonEmptyObject(),
      platform: {
        gitlab: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': prInfo(pr1),
            },
            updated_at: '2020-01-01T00:00:00.000Z',
          },
        },
      },
    });
  });

  it('resets cache for not matching authors', async () => {
    cache.platform = {
      gitlab: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
          },
          author: 'some-other-author',
          updated_at: '2020-01-01T00:00:00.000Z',
        },
      },
    };

    httpMock
      .scope('https://gitlab.com/api/v4/')
      .get(`/projects/repo/merge_requests?per_page=100&scope=created_by_me`)
      .reply(200, [pr1]);

    const res = await GitlabPrCache.getPrs(
      http,
      'repo',
      'some-author',
      ignorePrAuthor,
    );

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
    expect(cache).toEqual({
      httpCache: expect.toBeNonEmptyObject(),
      platform: {
        gitlab: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': prInfo(pr1),
            },
            updated_at: '2020-01-01T00:00:00.000Z',
          },
        },
      },
    });
  });

  it('syncs cache', async () => {
    cache.platform = {
      gitlab: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
          },
          author: 'some-author',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
      },
    };

    httpMock
      .scope('https://gitlab.com/api/v4')
      .get(`/projects/repo/merge_requests?per_page=100&scope=created_by_me`)
      .reply(200, [pr2]);

    const res = await GitlabPrCache.getPrs(
      http,
      'repo',
      'some-author',
      ignorePrAuthor,
    );

    expect(res).toMatchObject([
      { number: 2, title: 'title' },
      { number: 1, title: 'title' },
    ]);
    expect(cache).toEqual({
      httpCache: expect.toBeNonEmptyObject(),
      platform: {
        gitlab: {
          pullRequestsCache: {
            items: {
              '1': prInfo(pr1),
              '2': prInfo(pr2),
            },
            author: 'some-author',
            updated_at: '2023-01-01T00:00:00.000Z',
          },
        },
      },
    });
  });
});
