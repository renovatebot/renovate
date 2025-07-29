import * as httpMock from '../../../../test/http-mock';
import { reset as memCacheReset } from '../../../util/cache/memory';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository';
import {
  BitbucketServerHttp,
  setBaseUrl,
} from '../../../util/http/bitbucket-server';
import { BbsPrCache } from './pr-cache';
import type { BbsRestPr } from './types';
import { prInfo } from './utils';

const http = new BitbucketServerHttp();
const ignorePrAuthor = false;

const pr1: BbsRestPr = {
  id: 1,
  title: 'title',
  state: 'OPEN',
  createdDate: '1547853840016',
  updatedDate: 1547853840016,
  fromRef: {
    id: 'refs/heads/userName1/pullRequest5',
    displayId: 'userName1/pullRequest5',
  },
  toRef: {
    id: 'refs/heads/master',
    displayId: 'master',
  },
  reviewers: [],
  description: 'a merge request',
};

const pr2: BbsRestPr = {
  id: 2,
  title: 'title',
  state: 'OPEN',
  createdDate: '1547853840016',
  updatedDate: 1547853840016,
  fromRef: {
    id: 'refs/heads/userName1/pullRequest5',
    displayId: 'userName1/pullRequest5',
  },
  toRef: {
    id: 'refs/heads/master',
    displayId: 'master',
  },
  reviewers: [],
  description: 'a merge request',
};

const baseUrl = new URL('https://stash.renovatebot.com');
setBaseUrl('https://stash.renovatebot.com');
const urlHost = baseUrl.origin;
const urlPath = baseUrl.pathname === '/' ? '' : baseUrl.pathname;
describe('modules/platform/bitbucket-server/pr-cache', () => {
  let cache = getCache();

  beforeEach(() => {
    memCacheReset();
    repoCacheReset();
    cache = getCache();
  });

  it('fetches cache', async () => {
    httpMock
      .scope(urlHost)
      .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests`)
      .query(true)
      .reply(200, { values: [pr1], nextPageStart: 2 })
      .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests`)
      .query(true)
      .reply(200, { values: [pr2] });

    const res = await BbsPrCache.getPrs(
      http,
      'SOME',
      'repo',
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
        bitbucketServer: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': prInfo(pr1),
              '2': prInfo(pr2),
            },
            updatedDate: 1547853840016,
          },
        },
      },
    });
  });

  it('resets cache for not matching authors', async () => {
    cache.platform = {
      bitbucketServer: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
          },
          author: 'some-other-author',
          updatedDate: 1547853840016,
        },
      },
    };

    httpMock
      .scope(urlHost)
      .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests`)
      .query(true)
      .reply(200, { values: [pr1] });

    const res = await BbsPrCache.getPrs(
      http,
      'SOME',
      'repo',
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
        bitbucketServer: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': prInfo(pr1),
            },
            updatedDate: 1547853840016,
          },
        },
      },
    });
  });

  it('syncs cache', async () => {
    cache.platform = {
      bitbucketServer: {
        pullRequestsCache: {
          items: {
            '1': prInfo(pr1),
          },
          author: 'some-author',
          updatedDate: 1547853840016,
        },
      },
    };

    httpMock
      .scope(urlHost)
      .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests`)
      .query(true)
      .reply(200, { values: [pr2, pr1] });

    const res = await BbsPrCache.getPrs(
      http,
      'SOME',
      'repo',
      ignorePrAuthor,
      'some-author',
    );

    expect(res).toMatchObject([
      { number: 2, title: 'title' },
      { number: 1, title: 'title' },
    ]);
    expect(cache).toEqual({
      platform: {
        bitbucketServer: {
          pullRequestsCache: {
            items: {
              '1': prInfo(pr1),
              '2': prInfo(pr2),
            },
            author: 'some-author',
            updatedDate: 1547853840016,
          },
        },
      },
    });
  });
});
