import { GithubHttp } from '../../http/github.ts';
import { queryBranches, queryReleases, queryTags } from './index.ts';
import * as httpMock from '~test/http-mock.ts';

const http = new GithubHttp();

describe('util/github/graphql/index', () => {
  it('queryTags', async () => {
    httpMock
      .scope('https://api.github.com/')
      .post('/graphql')
      .reply(200, {
        data: {
          repository: {
            isPrivate: false,
            payload: {
              nodes: [
                {
                  version: '1.2.3',
                  target: {
                    type: 'Tag',
                    target: { type: 'Commit', oid: 'abc123' },
                    tagger: { releaseTimestamp: '2022-09-24' },
                  },
                },
              ],
            },
          },
        },
      });

    const res = await queryTags({ packageName: 'foo/bar' }, http);

    expect(res).toEqual([
      {
        gitRef: '1.2.3',
        hash: 'abc123',
        releaseTimestamp: '2022-09-24',
        version: '1.2.3',
      },
    ]);
  });

  it('queryReleases', async () => {
    httpMock
      .scope('https://api.github.com/')
      .post('/graphql')
      .reply(200, {
        data: {
          repository: {
            isPrivate: false,
            payload: {
              nodes: [
                {
                  version: '1.2.3',
                  releaseTimestamp: '2024-09-24',
                  isDraft: false,
                  isPrerelease: false,
                  url: 'https://example.com',
                  id: 123,
                  name: 'name',
                  description: 'description',
                },
              ],
            },
          },
        },
      });

    const res = await queryReleases({ packageName: 'foo/bar' }, http);

    expect(res).toEqual([
      {
        version: '1.2.3',
        releaseTimestamp: '2024-09-24T00:00:00.000Z',
        url: 'https://example.com',
        id: 123,
        name: 'name',
        description: 'description',
      },
    ]);
  });

  it('queryBranches', async () => {
    httpMock
      .scope('https://api.github.com/')
      .post('/graphql')
      .reply(200, {
        data: {
          repository: {
            isPrivate: false,
            payload: {
              nodes: [
                {
                  version: 'main',
                  target: {
                    type: 'Commit',
                    oid: 'abc123',
                    releaseTimestamp: '2022-09-24',
                  },
                },
              ],
            },
          },
        },
      });

    const res = await queryBranches({ packageName: 'foo/bar' }, http);

    expect(res).toEqual([
      {
        version: 'main',
        gitRef: 'main',
        hash: 'abc123',
        releaseTimestamp: '2022-09-24',
      },
    ]);
  });
});
