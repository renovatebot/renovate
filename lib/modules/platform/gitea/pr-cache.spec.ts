import { fakeSha, partial } from '~test/util.ts';
import * as httpMock from '../../../../test/http-mock.ts';
import { reset as memCacheReset } from '../../../util/cache/memory/index.ts';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository/index.ts';
import { GiteaHttp, setBaseUrl } from '../../../util/http/gitea.ts';
import { GiteaPrCache } from './pr-cache.ts';
import type { PR, Repo } from './schema.ts';
import { toRenovatePR } from './utils.ts';

const http = new GiteaHttp();
const ignorePrAuthor = false;

const baseUrl = 'https://gitea.renovatebot.com/api/v1';
setBaseUrl('https://gitea.renovatebot.com');

const pr1: PR = {
  number: 1,
  title: 'title',
  body: 'other random pull request',
  state: 'open',
  diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/3.diff',
  created_at: '2011-08-18T22:30:38Z',
  updated_at: '2011-08-18T22:30:38Z',
  closed_at: undefined,
  mergeable: true,
  base: { ref: 'third-party-base-branch' },
  head: {
    label: 'other-head-branch',
    sha: fakeSha('other-head-sha'),
    repo: partial<Repo>({ full_name: 'SOME/repo' }),
  },
  user: { id: 1, login: 'some-author' },
};

const pr2: PR = {
  number: 2,
  title: 'title',
  body: 'other random pull request',
  state: 'open',
  diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/3.diff',
  created_at: '2011-08-18T22:30:38Z',
  updated_at: '2011-08-18T22:30:38Z',
  closed_at: undefined,
  mergeable: true,
  base: { ref: 'third-party-base-branch' },
  head: {
    label: 'other-head-branch',
    sha: fakeSha('other-head-sha'),
    repo: partial<Repo>({ full_name: 'SOME/repo' }),
  },
  user: { id: 1, login: 'some-author' },
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
      'gitea',
      'SOME/repo',
      ignorePrAuthor,
      'some-author',
    );

    expect(res).toMatchObject([
      {
        number: 2,
        title: 'title',
      },
      {
        number: 1,
        title: 'title',
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
            updated_at: '2011-08-18T22:30:38Z',
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
      'gitea',
      'SOME/repo',
      ignorePrAuthor,
      'some-author',
    );

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
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
            updated_at: '2011-08-18T22:30:38Z',
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
      'gitea',
      'SOME/repo',
      ignorePrAuthor,
      'some-author',
    );

    expect(res).toMatchObject([
      {
        number: 2,
        title: 'title',
      },
      {
        number: 1,
        title: 'title',
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
            updated_at: '2011-08-18T22:30:38Z',
          },
        },
      },
    });
  });
});
