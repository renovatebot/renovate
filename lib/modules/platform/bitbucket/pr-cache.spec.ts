import * as httpMock from '../../../../test/http-mock';
import { reset as memCacheReset } from '../../../util/cache/memory';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository';
import { BitbucketHttp } from '../../../util/http/bitbucket';
import { BitbucketPrCache } from './pr-cache';
import type { PrResponse } from './types';
import { prInfo } from './utils';

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
    memCacheReset();
    repoCacheReset();
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

    const res = await BitbucketPrCache.getPrs(
      http,
      'some-workspace/some-repo',
      'some-author',
    );

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
    expect(cache).toEqual({
      httpCache: {},
      platform: {
        bitbucket: {
          pullRequestsCache: {
            author: 'some-author',
            items: {
              '1': prInfo(pr1),
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
            '1': prInfo(pr1),
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

    const res = await BitbucketPrCache.getPrs(
      http,
      'some-workspace/some-repo',
      'some-author',
    );

    expect(res).toMatchObject([
      { number: 1, title: 'title' },
      { number: 2, title: 'title' },
    ]);
    expect(cache).toEqual({
      httpCache: {},
      platform: {
        bitbucket: {
          pullRequestsCache: {
            items: {
              '1': prInfo(pr1),
              '2': prInfo(pr2),
            },
            author: 'some-author',
            updated_on: '2023-01-01T00:00:00.000Z',
          },
        },
      },
    });
  });
});
