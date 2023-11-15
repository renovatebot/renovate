import AggregateError from 'aggregate-error';
import * as httpMock from '../../../../test/http-mock';
import { partial } from '../../../../test/util';
import { GithubGraphqlResponse, GithubHttp } from '../../http/github';
import { range } from '../../range';
import {
  GithubGraphqlDatasourceFetcher as Datasource,
  GithubGraphqlDatasourceFetcher,
} from './datasource-fetcher';
import type {
  GithubDatasourceItem,
  GithubGraphqlDatasourceAdapter,
  GithubGraphqlRepoResponse,
} from './types';

interface TestAdapterInput {
  version: string;
  releaseTimestamp: string;
  foo: string;
}

interface TestAdapterOutput extends GithubDatasourceItem {
  bar: string;
}

const adapter: GithubGraphqlDatasourceAdapter<
  TestAdapterInput,
  TestAdapterOutput
> = {
  key: 'test-adapter',
  query: `
    items {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        version
        releaseTimestamp
        foo
      }
    }
  `,
  transform: ({
    version,
    releaseTimestamp,
    foo,
  }: TestAdapterInput): TestAdapterOutput | null =>
    version && releaseTimestamp && foo
      ? {
          version,
          releaseTimestamp,
          bar: foo,
        }
      : null,
};

function resp(
  isRepoPrivate: boolean | undefined,
  nodes: TestAdapterInput[],
  cursor: string | undefined = undefined,
): GithubGraphqlResponse<GithubGraphqlRepoResponse<TestAdapterInput>> {
  const data: GithubGraphqlRepoResponse<TestAdapterInput> = {
    repository: {
      isRepoPrivate,
      payload: { nodes },
    },
  };

  if (cursor) {
    data.repository.payload.pageInfo = {
      endCursor: cursor,
      hasNextPage: true,
    };
  }

  return { data };
}

function err(
  ...messages: string[]
): GithubGraphqlResponse<GithubGraphqlRepoResponse<TestAdapterInput>> {
  return {
    errors: messages.map((message) => ({ message })),
  };
}

async function catchError<T>(cb: () => Promise<T>): Promise<Error> {
  try {
    await cb();
    throw Error('Callback was expected to throw');
  } catch (err) {
    return err;
  }
}

describe('util/github/graphql/datasource-fetcher', () => {
  describe('query', () => {
    let http = new GithubHttp();

    const v1 = '1.0.0';
    const t1 = '01-01-2021';

    const v2 = '2.0.0';
    const t2 = '01-01-2022';

    const v3 = '3.0.0';
    const t3 = '01-01-2023';

    beforeEach(() => {
      http = new GithubHttp();
    });

    it('can perform query and receive result', async () => {
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .reply(200, resp(false, []));

      const res = await Datasource.query(
        { packageName: 'foo/bar' },
        http,
        adapter,
      );

      expect(res).toBeEmptyArray();
    });

    it('throws on unknown errors', async () => {
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .replyWithError('unknown error');

      await expect(() =>
        Datasource.query({ packageName: 'foo/bar' }, http, adapter),
      ).rejects.toThrow('unknown error');
    });

    it('throws single GraphQL error wrapped into Error', async () => {
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .reply(200, err('single error'));

      const res = await catchError(() =>
        Datasource.query({ packageName: 'foo/bar' }, http, adapter),
      );

      expect(res.message).toBe('single error');
      expect(res.constructor.name).toBe('Error');
    });

    it('throws multiple GraphQL errors wrapped into AggregatedError', async () => {
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .reply(200, err('first error', 'second error'));

      const res = (await catchError(() =>
        Datasource.query({ packageName: 'foo/bar' }, http, adapter),
      )) as AggregateError;

      expect(res).toBeInstanceOf(AggregateError);
      expect([...res]).toEqual([
        new Error('first error'),
        new Error('second error'),
      ]);
    });

    it('throws when neither of data or errors were provided', async () => {
      httpMock.scope('https://api.github.com/').post('/graphql').reply(200, {});

      await expect(() =>
        Datasource.query({ packageName: 'foo/bar' }, http, adapter),
      ).rejects.toThrow('GitHub GraphQL datasource: failed to obtain data');
    });

    it('throws when repository field is absent', async () => {
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .reply(200, { data: {} });

      await expect(() =>
        Datasource.query({ packageName: 'foo/bar' }, http, adapter),
      ).rejects.toThrow(
        'GitHub GraphQL datasource: failed to obtain repository data',
      );
    });

    it('throws when payload field is absent', async () => {
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .reply(200, { data: { repository: {} } });

      await expect(() =>
        Datasource.query({ packageName: 'foo/bar' }, http, adapter),
      ).rejects.toThrow(
        'GitHub GraphQL datasource: failed to obtain repository payload data',
      );
    });

    it('receives, transforms, and return data', async () => {
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .reply(
          200,
          resp(false, [
            { version: v3, releaseTimestamp: t3, foo: '3' },
            { version: v2, releaseTimestamp: t2, foo: '2' },
            partial<TestAdapterInput>(),
            { version: v1, releaseTimestamp: t1, foo: '1' },
          ]),
        );

      const res = await Datasource.query(
        { packageName: 'foo/bar' },
        http,
        adapter,
      );

      expect(res).toEqual([
        { version: v3, releaseTimestamp: t3, bar: '3' },
        { version: v2, releaseTimestamp: t2, bar: '2' },
        { version: v1, releaseTimestamp: t1, bar: '1' },
      ]);
    });

    it('handles paginated data', async () => {
      const page1 = resp(
        false,
        [{ version: v3, releaseTimestamp: t3, foo: '3' }],
        'aaa',
      );
      const page2 = resp(
        false,
        [{ version: v2, releaseTimestamp: t2, foo: '2' }],
        'bbb',
      );
      const page3 = resp(false, [
        { version: v1, releaseTimestamp: t1, foo: '1' },
      ]);
      httpMock
        .scope('https://api.github.com/')
        .post('/graphql')
        .reply(200, page1)
        .post('/graphql')
        .reply(200, page2)
        .post('/graphql')
        .reply(200, page3);

      const res = await Datasource.query(
        { packageName: 'foo/bar' },
        http,
        adapter,
      );

      expect(res).toEqual([
        { version: v3, releaseTimestamp: t3, bar: '3' },
        { version: v2, releaseTimestamp: t2, bar: '2' },
        { version: v1, releaseTimestamp: t1, bar: '1' },
      ]);
    });

    /**
     * See: #16343
     */
    describe('Page shrinking', () => {
      function generateItems(count: number): TestAdapterInput[] {
        const indices = [...range(1, count)].map((x) => `${x}`);
        return indices.map((idx) => ({
          version: idx,
          releaseTimestamp: idx,
          foo: idx,
        }));
      }

      function partitionBy<T>(input: T[], count: number): T[][] {
        const output: T[][] = [];
        for (let idx = 0; idx < input.length; idx += count) {
          const slice = input.slice(idx, idx + count);
          output.push(slice);
        }
        return output;
      }

      function generatePages(
        items: TestAdapterInput[],
        perPage: number,
      ): GithubGraphqlResponse<GithubGraphqlRepoResponse<TestAdapterInput>>[] {
        const partitions = partitionBy(items, perPage);
        const pages = partitions.map((nodes, idx) =>
          resp(false, nodes, `page-${idx + 2}`),
        );
        delete pages[pages.length - 1].data?.repository.payload.pageInfo;
        return pages;
      }

      it('shrinks page from 100 to 50', async () => {
        const items = generateItems(150);
        const pages = generatePages(items, 50);
        const scope = httpMock
          .scope('https://api.github.com/')
          .post('/graphql')
          .reply(200, err('Something went wrong while executing your query.'));
        pages.forEach((page) => {
          scope.post('/graphql').reply(200, page);
        });

        const res = await Datasource.query(
          { packageName: 'foo/bar' },
          http,
          adapter,
        );

        expect(res).toHaveLength(150);
        expect(res).toEqual(items.map(adapter.transform));
        expect(httpMock.getTrace()).toMatchObject([
          { body: { variables: { count: 100, cursor: null } } },
          { body: { variables: { count: 50, cursor: null } } },
          { body: { variables: { count: 50, cursor: 'page-2' } } },
          { body: { variables: { count: 50, cursor: 'page-3' } } },
        ]);
      });

      it('shrinks page from 50 to 25', async () => {
        const items = generateItems(100);
        const pages = generatePages(items, 25);
        const scope = httpMock
          .scope('https://api.github.com/')
          .post('/graphql')
          .twice()
          .reply(200, err('Something went wrong while executing your query.'));
        pages.forEach((page) => {
          scope.post('/graphql').reply(200, page);
        });

        const res = await Datasource.query(
          { packageName: 'foo/bar' },
          http,
          adapter,
        );

        expect(res).toHaveLength(100);
        expect(res).toEqual(items.map(adapter.transform));
        expect(httpMock.getTrace()).toMatchObject([
          { body: { variables: { count: 100, cursor: null } } },
          { body: { variables: { count: 50, cursor: null } } },
          { body: { variables: { count: 25, cursor: null } } },
          { body: { variables: { count: 25, cursor: 'page-2' } } },
          { body: { variables: { count: 25, cursor: 'page-3' } } },
          { body: { variables: { count: 25, cursor: 'page-4' } } },
        ]);
      });

      it('re-throws if shrinking did not help', async () => {
        httpMock
          .scope('https://api.github.com/')
          .post('/graphql')
          .thrice()
          .reply(200, err('Something went wrong while executing your query.'));

        await expect(
          Datasource.query({ packageName: 'foo/bar' }, http, adapter),
        ).rejects.toThrow('Something went wrong while executing your query.');

        expect(httpMock.getTrace()).toMatchObject([
          { body: { variables: { count: 100, cursor: null } } },
          { body: { variables: { count: 50, cursor: null } } },
          { body: { variables: { count: 25, cursor: null } } },
        ]);
      });
    });

    describe('Cacheable flag', () => {
      const data = [
        { version: v3, releaseTimestamp: t3, foo: '3' },
        { version: v2, releaseTimestamp: t2, foo: '2' },
        { version: v1, releaseTimestamp: t1, foo: '1' },
      ];

      it.each`
        isPrivate    | isCacheable
        ${undefined} | ${false}
        ${true}      | ${false}
        ${false}     | ${true}
      `(
        'private=$isPrivate => isCacheable=$isCacheable',
        async ({ isPrivate, isCacheable }) => {
          httpMock
            .scope('https://api.github.com/')
            .post('/graphql')
            .reply(200, resp(isPrivate, data, undefined));

          const instance = new GithubGraphqlDatasourceFetcher(
            { packageName: 'foo/bar' },
            http,
            adapter,
          );
          await instance.getItems();

          expect(instance).toHaveProperty('isCacheable', isCacheable);
        },
      );
    });
  });
});
