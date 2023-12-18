import * as httpMock from '../../../../test/http-mock';
import { getCache, resetCache } from '../../../util/cache/repository';
import { BitbucketHttp } from '../../../util/http/bitbucket';
import { BitbucketPrCache } from './pr-cache';
import type { PrResponse } from './types';

const http = new BitbucketHttp();

const pr1: PrResponse = {
  id: 1,
  title: 'title',
  state: 'OPEN',
  links: {
    commits: {
      href: 'https://api.bitbucket.org/2.0/repositories/some/repo/pullrequests/1/commits',
    },
  },
  source: { branch: { name: 'branch' } },
  destination: { branch: { name: 'master' } },
  reviewers: [],
  created_on: '2020-01-01T00:00:00.000Z',
  updated_on: '2020-01-01T00:00:00.000Z',
};

const pr2: PrResponse = {
  id: 2,
  title: 'title',
  state: 'OPEN',
  links: {
    commits: {
      href: 'https://api.bitbucket.org/2.0/repositories/some/repo/pullrequests/2/commits',
    },
  },
  source: { branch: { name: 'branch' } },
  destination: { branch: { name: 'master' } },
  reviewers: [],
  created_on: '2023-01-01T00:00:00.000Z',
  updated_on: '2023-01-01T00:00:00.000Z',
};

describe('modules/platform/bitbucket/pr-cache', () => {
  let cache = getCache();

  beforeEach(() => {
    resetCache();
    cache = getCache();
  });

  it('fetches cache', async () => {
    httpMock
      .scope('https://api.bitbucket.org')
      .get(`/2.0/repositories/some-workspace/some-repo/pullrequests`)
      .query(true)
      .reply(200, {
        values: [pr1],
      });

    const res = await BitbucketPrCache.init(
      'some-workspace/some-repo',
      'some-author',
    )
      .sync(http)
      .then((cache) => cache.getPrs());

    expect(res).toEqual([pr1]);
    expect(cache).toEqual({
      platform: {
        bitbucket: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': pr1,
            },
            updated_on: '2020-01-01T00:00:00.000Z',
          },
        },
      },
    });
  });

  it('syncs cache', async () => {
    cache.platform = {
      bitbucket: {
        pullRequestsCache: {
          items: {
            '1': pr1,
          },
          author: 'some-author',
          updated_on: '2020-01-01T00:00:00.000Z',
        },
      },
    };

    httpMock
      .scope('https://api.bitbucket.org')
      .get(`/2.0/repositories/some-workspace/some-repo/pullrequests`)
      .query(true)
      .reply(200, {
        values: [pr2],
      });

    const res = await BitbucketPrCache.init(
      'some-workspace/some-repo',
      'some-author',
    )
      .sync(http)
      .then((cache) => cache.getPrs());

    expect(res).toEqual([pr1, pr2]);
    expect(cache).toEqual({
      platform: {
        bitbucket: {
          pullRequestsCache: {
            items: {
              '1': pr1,
              '2': pr2,
            },
            author: 'some-author',
            updated_on: '2023-01-01T00:00:00.000Z',
          },
        },
      },
    });
  });
});
