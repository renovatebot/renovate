import * as httpMock from '~test/http-mock.ts';
import { GithubHttp } from '../../http/github.ts';
import { queryTagsByName, tagsPerQuery } from './tags-by-name.ts';

describe('util/github/graphql/tags-by-name', () => {
  let http: GithubHttp;

  beforeEach(() => {
    http = new GithubHttp();
  });

  it('returns the tags which exist', async () => {
    httpMock
      .scope('https://api.github.com/')
      .post(
        '/graphql',
        ({ variables }) =>
          variables.owner === 'foo' &&
          variables.name === 'bar' &&
          variables.tag0 === 'refs/tags/v1.0.0' &&
          variables.tag1 === 'refs/tags/v1.1.0' &&
          variables.tag2 === 'refs/tags/v2.0.0' &&
          variables.tag3 === 'refs/tags/v3.0.0',
      )
      .reply(200, {
        data: {
          repository: {
            tag0: {
              version: 'v1.0.0',
              target: {
                type: 'Commit',
                oid: 'abc123',
                releaseTimestamp: '2026-01-01T00:00:00Z',
              },
            },
            tag1: {
              version: 'v1.1.0',
              target: {
                type: 'Tag',
                target: { type: 'Commit', oid: 'def456' },
                tagger: { releaseTimestamp: '2026-02-01T00:00:00Z' },
              },
            },
            tag2: null,
            tag3: {
              version: 'v3.0.0',
              target: {
                type: 'Tag',
                target: { type: 'Tag', target: { oid: 'ghi789' } },
                tagger: { releaseTimestamp: '2026-03-01T00:00:00Z' },
              },
            },
          },
        },
      });

    const res = await queryTagsByName({ packageName: 'foo/bar' }, http, [
      'v1.0.0',
      'v1.1.0',
      'v2.0.0',
      'v3.0.0',
    ]);

    expect(res).toEqual([
      {
        version: 'v1.0.0',
        gitRef: 'v1.0.0',
        hash: 'abc123',
        releaseTimestamp: '2026-01-01T00:00:00Z',
      },
      {
        version: 'v1.1.0',
        gitRef: 'v1.1.0',
        hash: 'def456',
        releaseTimestamp: '2026-02-01T00:00:00Z',
      },
      {
        version: 'v3.0.0',
        gitRef: 'v3.0.0',
        hash: 'ghi789',
        releaseTimestamp: '2026-03-01T00:00:00Z',
      },
    ]);
  });

  it('skips tags it cannot parse', async () => {
    httpMock
      .scope('https://api.github.com/')
      .post('/graphql')
      .reply(200, {
        data: {
          repository: {
            tag0: { version: 'v1.0.0', target: { type: 'Blob' } },
          },
        },
      });

    const res = await queryTagsByName({ packageName: 'foo/bar' }, http, [
      'v1.0.0',
    ]);

    expect(res).toBeEmptyArray();
  });

  it(`looks up at most ${tagsPerQuery} tags per query`, async () => {
    const tagNames = Array.from(
      { length: tagsPerQuery + 1 },
      (_, i) => `v1.0.${i}`,
    );
    httpMock
      .scope('https://api.github.com/')
      .post(
        '/graphql',
        ({ variables }) =>
          Object.keys(variables).length === tagsPerQuery + 2 &&
          variables.tag0 === 'refs/tags/v1.0.0',
      )
      .reply(200, { data: { repository: {} } })
      .post(
        '/graphql',
        ({ variables }) =>
          Object.keys(variables).length === 3 &&
          variables.tag0 === `refs/tags/v1.0.${tagsPerQuery}`,
      )
      .reply(200, { data: { repository: {} } });

    const res = await queryTagsByName(
      { packageName: 'foo/bar' },
      http,
      tagNames,
    );

    expect(res).toBeEmptyArray();
  });

  it('does not query without tags', async () => {
    const res = await queryTagsByName({ packageName: 'foo/bar' }, http, []);

    expect(res).toBeEmptyArray();
  });

  it('handles a missing repository', async () => {
    httpMock
      .scope('https://api.github.com/')
      .post('/graphql')
      .reply(200, { data: { repository: null } });

    const res = await queryTagsByName({ packageName: 'foo/bar' }, http, [
      'v1.0.0',
    ]);

    expect(res).toBeEmptyArray();
  });

  it('keeps the tags of the other queries when a query fails', async () => {
    const tagNames = Array.from(
      { length: tagsPerQuery + 1 },
      (_, i) => `v1.0.${i}`,
    );
    httpMock
      .scope('https://api.github.com/')
      .post(
        '/graphql',
        ({ variables }) => variables.tag0 === 'refs/tags/v1.0.0',
      )
      .reply(200, {
        data: {
          repository: {
            tag0: {
              version: 'v1.0.0',
              target: {
                type: 'Commit',
                oid: 'abc123',
                releaseTimestamp: '2026-01-01T00:00:00Z',
              },
            },
          },
        },
      })
      .post(
        '/graphql',
        ({ variables }) => variables.tag0 === `refs/tags/v1.0.${tagsPerQuery}`,
      )
      .reply(200, { errors: [{ message: 'Something went wrong' }] });

    const res = await queryTagsByName(
      { packageName: 'foo/bar' },
      http,
      tagNames,
    );

    expect(res).toEqual([
      {
        version: 'v1.0.0',
        gitRef: 'v1.0.0',
        hash: 'abc123',
        releaseTimestamp: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('supports GitHub Enterprise Server', async () => {
    httpMock
      .scope('https://github.example.com/api/')
      .post('/graphql')
      .reply(200, { data: { repository: { tag0: null } } });

    const res = await queryTagsByName(
      { packageName: 'foo/bar', registryUrl: 'https://github.example.com' },
      http,
      ['v1.0.0'],
    );

    expect(res).toBeEmptyArray();
  });
});
