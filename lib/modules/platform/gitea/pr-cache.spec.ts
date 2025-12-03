import * as httpMock from '../../../../test/http-mock';
import { reset as memCacheReset } from '../../../util/cache/memory';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository';
import type { LongCommitSha } from '../../../util/git/types';
import { GiteaHttp, setBaseUrl } from '../../../util/http/gitea';
import { GiteaPrCache } from './pr-cache';
import type { PR, Repo } from './types';
import { toRenovatePR } from './utils';
import { partial } from '~test/util';

const http = new GiteaHttp();
const ignorePrAuthor = false;

const baseUrl = 'https://gitea.com/api/v1';
setBaseUrl('https://gitea.com/');

const pr1: PR = {
  number: 1,
  title: 'Some PR',
  body: 'some random pull request',
  state: 'open',
  diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/1.diff',
  created_at: '2015-03-22T20:36:16Z',
  closed_at: '2015-03-22T21:36:16Z',
  updated_at: '2015-03-22T21:36:16Z',
  mergeable: true,
  base: { ref: 'some-base-branch' },
  head: {
    label: 'some-head-branch',
    sha: 'some-head-sha' as LongCommitSha,
    repo: partial<Repo>({ full_name: 'some/repo' }),
  },
};

const pr2: PR = {
  number: 2,
  title: 'Other PR',
  body: 'other random pull request',
  state: 'closed',
  diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/2.diff',
  created_at: '2011-08-18T22:30:38Z',
  closed_at: '2016-01-09T10:03:21Z',
  updated_at: '2016-01-09T10:03:21Z',
  mergeable: true,
  base: { ref: 'other-base-branch' },
  head: {
    label: 'other-head-branch',
    sha: 'other-head-sha' as LongCommitSha,
    repo: partial<Repo>({ full_name: 'some/repo' }),
  },
  labels: [
    {
      id: 1,
      name: 'bug',
    },
  ],
};

describe('modules/platform/gitea/pr-cache', () => {
  let cache = getCache();

  beforeEach(() => {
    memCacheReset();
    repoCacheReset();
    cache = getCache();
  });

  it('fetches cache - author defined', async () => {
    httpMock
      .scope(baseUrl)
      .get(
        '/repos/SOME/repo/pulls?state=all&sort=recentupdate&limit=100&poster=some-author',
      )
      .reply(200, [pr1], {
        Link: '<https://stash.renovatebot.com/repos/SOME/repo/pulls?state=all&sort=recentupdate&limit=50&page=2>; rel="next"',
      })
      .get(
        '/repos/SOME/repo/pulls?&state=all&sort=recentupdate&limit=50&page=2',
      )
      .reply(200, [pr2]);

    const res = await GiteaPrCache.getPrs(
      http,
      'SOME/repo',
      ignorePrAuthor,
      'some-author',
    );

    expect(res).toMatchObject([
      {
        number: 2,
        title: 'Other PR',
      },
      {
        number: 1,
        title: 'Some PR',
      },
    ]);
    expect(cache).toEqual({
      platform: {
        gitea: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': toRenovatePR(pr1, 'some-author'),
              '2': toRenovatePR(pr2, 'some-author'),
            },
            updated_at: '2016-01-09T10:03:21Z',
          },
        },
      },
    });
  });

  it('resets cache for not matching authors', async () => {
    cache.platform = {
      gitea: {
        pullRequestsCache: {
          items: {
            '1': toRenovatePR(pr1, 'some-other-author'),
          },
          author: 'some-other-author',
          updated_at: '2011-08-18T22:30:38Z',
        },
      },
    };

    httpMock
      .scope(baseUrl)
      .get(
        '/repos/SOME/repo/pulls?state=all&sort=recentupdate&limit=100&poster=some-author',
      )
      .reply(200, [pr1]);

    const res = await GiteaPrCache.getPrs(
      http,
      'SOME/repo',
      ignorePrAuthor,
      'some-author',
    );

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'Some PR',
      },
    ]);
    expect(cache).toEqual({
      platform: {
        gitea: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': toRenovatePR(pr1, 'some-author'),
            },
            updated_at: '2015-03-22T21:36:16Z',
          },
        },
      },
    });
  });

  it('syncs cache', async () => {
    cache.platform = {
      gitea: {
        pullRequestsCache: {
          items: {
            '1': toRenovatePR(pr1, 'some-author'),
          },
          author: 'some-author',
          updated_at: '2011-08-18T22:30:38Z',
        },
      },
    };

    httpMock
      .scope(baseUrl)
      .get(
        '/repos/SOME/repo/pulls?state=all&sort=recentupdate&limit=20&poster=some-author',
      )
      .reply(200, [pr2, pr1]);

    const res = await GiteaPrCache.getPrs(
      http,
      'SOME/repo',
      ignorePrAuthor,
      'some-author',
    );

    expect(res).toMatchObject([
      {
        number: 2,
        title: 'Other PR',
      },
      {
        number: 1,
        title: 'Some PR',
      },
    ]);
    expect(cache).toEqual({
      platform: {
        gitea: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': toRenovatePR(pr1, 'some-author'),
              '2': toRenovatePR(pr2, 'some-author'),
            },
            updated_at: '2016-01-09T10:03:21Z',
          },
        },
      },
    });
  });
});
