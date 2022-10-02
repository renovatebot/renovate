import { DateTime } from 'luxon';
import { mocked } from '../../../../../test/util';
import * as _packageCache from '../../../../util/cache/package';
import type {
  GithubCachedItem,
  GithubGraphqlRepoResponse,
} from '../../../../util/github/types';
import {
  GithubGraphqlResponse,
  GithubHttp,
} from '../../../../util/http/github';
import { AbstractGithubDatasourceCache } from './cache-base';

jest.mock('../../../../util/cache/package');
const packageCache = mocked(_packageCache);

interface FetchedItem {
  name: string;
  createdAt: string;
  foo: string;
}

interface StoredItem extends GithubCachedItem {
  bar: string;
}

type GraphqlDataResponse = {
  statusCode: 200;
  headers: Record<string, string>;
  body: GithubGraphqlResponse<GithubGraphqlRepoResponse<FetchedItem>>;
};

type GraphqlResponse = GraphqlDataResponse | Error;

class TestCache extends AbstractGithubDatasourceCache<StoredItem, FetchedItem> {
  cacheNs = 'test-cache';
  graphqlQuery = `query { ... }`;

  coerceFetched({
    name: version,
    createdAt: releaseTimestamp,
    foo: bar,
  }: FetchedItem): StoredItem | null {
    return version === 'invalid' ? null : { version, releaseTimestamp, bar };
  }

  isEquivalent({ bar: x }: StoredItem, { bar: y }: StoredItem): boolean {
    return x === y;
  }
}

function resp(items: FetchedItem[], hasNextPage = false): GraphqlDataResponse {
  return {
    statusCode: 200,
    headers: {},
    body: {
      data: {
        repository: {
          payload: {
            nodes: items,
            pageInfo: {
              hasNextPage,
              endCursor: 'abc',
            },
          },
        },
      },
    },
  };
}

const sortItems = (items: StoredItem[]) =>
  items.sort(({ releaseTimestamp: x }, { releaseTimestamp: y }) =>
    x.localeCompare(y)
  );

describe('modules/datasource/github-releases/cache/cache-base', () => {
  const http = new GithubHttp();
  const httpPostJson = jest.spyOn(GithubHttp.prototype, 'postJson');

  const now = DateTime.local(2022, 6, 15, 18, 30, 30);
  const t1 = now.minus({ days: 3 }).toISO();
  const t2 = now.minus({ days: 2 }).toISO();
  const t3 = now.minus({ days: 1 }).toISO();

  let responses: GraphqlResponse[] = [];

  beforeEach(() => {
    responses = [];
    jest.resetAllMocks();
    jest.spyOn(DateTime, 'now').mockReturnValue(now);
    httpPostJson.mockImplementation(() => {
      const resp = responses.shift()!;
      return resp instanceof Error
        ? Promise.reject(resp)
        : Promise.resolve(resp);
    });
  });

  it('performs pre-fetch', async () => {
    responses = [
      resp([{ name: 'v3', createdAt: t3, foo: 'ccc' }], true),
      resp([{ name: 'v2', createdAt: t2, foo: 'bbb' }], true),
      resp([{ name: 'v1', createdAt: t1, foo: 'aaa' }]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1', bar: 'aaa' },
      { version: 'v2', bar: 'bbb' },
      { version: 'v3', bar: 'ccc' },
    ]);
    expect(packageCache.set).toHaveBeenCalledWith(
      'test-cache',
      'https://api.github.com/:foo:bar',
      {
        createdAt: now.toISO(),
        updatedAt: now.toISO(),
        lastReleasedAt: t3,
        items: {
          v1: { bar: 'aaa', releaseTimestamp: t1, version: 'v1' },
          v2: { bar: 'bbb', releaseTimestamp: t2, version: 'v2' },
          v3: { bar: 'ccc', releaseTimestamp: t3, version: 'v3' },
        },
      },
      7 * 24 * 60
    );
  });

  it('filters out items being coerced to null', async () => {
    responses = [
      resp([{ name: 'v3', createdAt: t3, foo: 'ccc' }], true),
      resp([{ name: 'invalid', createdAt: t3, foo: 'xxx' }], true),
      resp([{ name: 'v2', createdAt: t2, foo: 'bbb' }], true),
      resp([{ name: 'v1', createdAt: t1, foo: 'aaa' }]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1' },
      { version: 'v2' },
      { version: 'v3' },
    ]);
  });

  it('updates items', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {
        v1: { version: 'v1', releaseTimestamp: t1, bar: 'aaa' },
        v2: { version: 'v2', releaseTimestamp: t2, bar: 'bbb' },
        v3: { version: 'v3', releaseTimestamp: t3, bar: 'ccc' },
      },
      createdAt: t3,
      updatedAt: t3,
    });

    responses = [
      resp([{ name: 'v3', createdAt: t3, foo: 'xxx' }], true),
      resp([{ name: 'v2', createdAt: t2, foo: 'bbb' }], true),
      resp([{ name: 'v1', createdAt: t1, foo: 'aaa' }]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1', bar: 'aaa' },
      { version: 'v2', bar: 'bbb' },
      { version: 'v3', bar: 'xxx' },
    ]);
    expect(packageCache.set).toHaveBeenCalledWith(
      'test-cache',
      'https://api.github.com/:foo:bar',
      {
        createdAt: t3,
        updatedAt: now.toISO(),
        lastReleasedAt: t3,
        items: {
          v1: { bar: 'aaa', releaseTimestamp: t1, version: 'v1' },
          v2: { bar: 'bbb', releaseTimestamp: t2, version: 'v2' },
          v3: { bar: 'xxx', releaseTimestamp: t3, version: 'v3' },
        },
      },
      6 * 24 * 60
    );
  });

  it('does not update non-fresh packages earlier than 120 minutes ago', async () => {
    const releaseTimestamp = now.minus({ days: 7 }).toISO();
    const createdAt = now.minus({ minutes: 119 }).toISO();
    packageCache.get.mockResolvedValueOnce({
      items: { v1: { version: 'v1', releaseTimestamp, bar: 'aaa' } },
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    responses = [
      resp([
        { name: 'v1', createdAt: releaseTimestamp, foo: 'aaa' },
        { name: 'v2', createdAt: now.toISO(), foo: 'bbb' },
      ]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1', releaseTimestamp, bar: 'aaa' },
    ]);
    expect(httpPostJson).not.toHaveBeenCalled();
  });

  it('updates non-fresh packages after 120 minutes', async () => {
    const releaseTimestamp = now.minus({ days: 7 }).toISO();
    const recentTimestamp = now.toISO();
    const createdAt = now.minus({ minutes: 120 }).toISO();
    packageCache.get.mockResolvedValueOnce({
      items: { v1: { version: 'v1', releaseTimestamp, bar: 'aaa' } },
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    responses = [
      resp([
        { name: 'v1', createdAt: releaseTimestamp, foo: 'aaa' },
        { name: 'v2', createdAt: recentTimestamp, foo: 'bbb' },
      ]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1', releaseTimestamp, bar: 'aaa' },
      { version: 'v2', releaseTimestamp: recentTimestamp, bar: 'bbb' },
    ]);
    expect(packageCache.set).toHaveBeenCalledWith(
      'test-cache',
      'https://api.github.com/:foo:bar',
      {
        createdAt: createdAt,
        items: {
          v1: { bar: 'aaa', releaseTimestamp, version: 'v1' },
          v2: { bar: 'bbb', releaseTimestamp: recentTimestamp, version: 'v2' },
        },
        lastReleasedAt: recentTimestamp,
        updatedAt: recentTimestamp,
      },
      60 * 24 * 7 - 120
    );
  });

  it('stops updating once stability period have passed', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {
        v1: { version: 'v1', releaseTimestamp: t1, bar: 'aaa' },
        v2: { version: 'v2', releaseTimestamp: t2, bar: 'bbb' },
        v3: { version: 'v3', releaseTimestamp: t3, bar: 'ccc' },
      },
      createdAt: t3,
      updatedAt: t3,
    });
    responses = [
      resp([{ name: 'v3', createdAt: t3, foo: 'zzz' }], true),
      resp([{ name: 'v2', createdAt: t2, foo: 'yyy' }], true),
      resp([{ name: 'v1', createdAt: t1, foo: 'xxx' }]),
    ];
    const cache = new TestCache(http, { unstableDays: 1.5 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1', bar: 'aaa' },
      { version: 'v2', bar: 'yyy' },
      { version: 'v3', bar: 'zzz' },
    ]);
  });

  it('removes deleted items from cache', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {
        v1: { version: 'v1', releaseTimestamp: t1, bar: 'aaa' },
        v2: { version: 'v2', releaseTimestamp: t2, bar: 'bbb' },
        v3: { version: 'v3', releaseTimestamp: t3, bar: 'ccc' },
      },
      createdAt: t3,
      updatedAt: t3,
    });
    responses = [
      resp([{ name: 'v3', createdAt: t3, foo: 'ccc' }], true),
      resp([{ name: 'v1', createdAt: t1, foo: 'aaa' }]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1', bar: 'aaa' },
      { version: 'v3', bar: 'ccc' },
    ]);
  });

  it('throws for http errors', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {
        v1: { version: 'v1', releaseTimestamp: t1, bar: 'aaa' },
        v2: { version: 'v2', releaseTimestamp: t2, bar: 'bbb' },
        v3: { version: 'v3', releaseTimestamp: t3, bar: 'ccc' },
      },
      createdAt: t3,
      updatedAt: t3,
    });
    responses = [
      resp([{ name: 'v3', createdAt: t3, foo: 'zzz' }], true),
      new Error('Unknown error'),
      resp([{ name: 'v1', createdAt: t1, foo: 'xxx' }]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    await expect(cache.getItems({ packageName: 'foo/bar' })).rejects.toThrow(
      'Unknown error'
    );
    expect(packageCache.get).toHaveBeenCalled();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('throws for graphql errors', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {},
      createdAt: t3,
      updatedAt: t3,
    });
    responses = [
      {
        statusCode: 200,
        headers: {},
        body: { errors: [{} as never, { message: 'Ooops' }] },
      },
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    await expect(cache.getItems({ packageName: 'foo/bar' })).rejects.toThrow(
      'Ooops'
    );
    expect(packageCache.get).toHaveBeenCalled();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('throws for unknown graphql errors', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {},
      createdAt: t3,
      updatedAt: t3,
    });
    responses = [
      {
        statusCode: 200,
        headers: {},
        body: { errors: [] },
      },
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    await expect(cache.getItems({ packageName: 'foo/bar' })).rejects.toThrow(
      'GitHub datasource cache: unknown GraphQL error'
    );
    expect(packageCache.get).toHaveBeenCalled();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('throws for empty payload', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {},
      createdAt: t3,
      updatedAt: t3,
    });
    responses = [
      {
        statusCode: 200,
        headers: {},
        body: { data: { repository: { payload: null as never } } },
      },
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    await expect(cache.getItems({ packageName: 'foo/bar' })).rejects.toThrow(
      'GitHub datasource cache: failed to obtain payload data'
    );
    expect(packageCache.get).toHaveBeenCalled();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('shrinks for some of graphql errors', async () => {
    packageCache.get.mockResolvedValueOnce({
      items: {},
      createdAt: t3,
      updatedAt: t3,
    });
    responses = [
      {
        statusCode: 200,
        headers: {},
        body: {
          errors: [
            { message: 'Something went wrong while executing your query.' },
          ],
        },
      },
      resp([{ name: 'v3', createdAt: t3, foo: 'ccc' }], true),
      resp([{ name: 'v2', createdAt: t2, foo: 'bbb' }], true),
      resp([{ name: 'v1', createdAt: t1, foo: 'aaa' }]),
    ];
    const cache = new TestCache(http, { resetDeltaMinutes: 0 });

    const res = await cache.getItems({ packageName: 'foo/bar' });

    expect(sortItems(res)).toMatchObject([
      { version: 'v1', bar: 'aaa' },
      { version: 'v2', bar: 'bbb' },
      { version: 'v3', bar: 'ccc' },
    ]);
    expect(packageCache.set).toHaveBeenCalled();
  });

  it('finds latest release timestamp correctly', () => {
    const cache = new TestCache(http);
    const ts = cache.getLastReleaseTimestamp({
      v2: { bar: 'bbb', releaseTimestamp: t2, version: 'v2' },
      v3: { bar: 'ccc', releaseTimestamp: t3, version: 'v3' },
      v1: { bar: 'aaa', releaseTimestamp: t1, version: 'v1' },
    });
    expect(ts).toEqual(t3);
  });

  describe('Changelog-based cache busting', () => {
    describe('newChangelogReleaseDetected', () => {
      const cache = new TestCache(http, { resetDeltaMinutes: 0 });

      it('returns false for undefined release argument', () => {
        expect(
          cache.newChangelogReleaseDetected(undefined, now, {}, {})
        ).toBeFalse();
      });

      it('returns false if version is present in cache', () => {
        expect(
          cache.newChangelogReleaseDetected(
            { date: now.minus({ minutes: 10 }).toISO(), version: '1.2.3' },
            now,
            { minutes: 20 },
            {
              '1.2.3': {
                bar: '1',
                version: '1.2.3',
                releaseTimestamp: now.toISO(),
              },
            }
          )
        ).toBeFalse();
      });

      it('returns false if changelog release is not fresh', () => {
        expect(
          cache.newChangelogReleaseDetected(
            { date: now.minus({ minutes: 20 }).toISO(), version: '1.2.3' },
            now,
            { minutes: 10 },
            {}
          )
        ).toBeFalse();
      });

      it('returns true for fresh changelog release', () => {
        expect(
          cache.newChangelogReleaseDetected(
            { date: now.minus({ minutes: 10 }).toISO(), version: '1.2.3' },
            now,
            { minutes: 20 },
            {}
          )
        ).toBeTrue();
      });
    });

    it('forces cache update', async () => {
      const lastUpdateTime = now.minus({ minutes: 15 }).toISO();
      const githubTime = now.minus({ minutes: 10 }).toISO();
      const changelogTime = now.minus({ minutes: 5 }).toISO();
      packageCache.get.mockResolvedValueOnce({
        items: {},
        createdAt: lastUpdateTime,
        updatedAt: lastUpdateTime,
      });
      responses = [
        resp([{ name: '1.0.0', createdAt: githubTime, foo: 'aaa' }]),
      ];
      const cache = new TestCache(http, { resetDeltaMinutes: 0 });

      const res = await cache.getItems({ packageName: 'foo/bar' }, {
        version: '1.0.0',
        date: changelogTime,
      } as never);

      expect(sortItems(res)).toEqual([
        {
          bar: 'aaa',
          releaseTimestamp: githubTime,
          version: '1.0.0',
        },
      ]);
    });
  });
});
