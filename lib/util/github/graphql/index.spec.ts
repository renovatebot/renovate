import * as httpMock from '../../../../test/http-mock';
import { GithubHttp } from '../../http/github';
import { queryReleases, queryTags } from '.';

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
                    target: { oid: 'abc123' },
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
        releaseTimestamp: '2024-09-24',
        url: 'https://example.com',
        id: 123,
        name: 'name',
        description: 'description',
      },
    ]);
  });
});
