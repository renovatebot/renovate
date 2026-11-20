import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { GithubHttp } from '../../http/github.ts';
import { GithubIpAllowListError } from '../ip-allow-list.ts';
import { queryBranches, queryReleases, queryTags } from './index.ts';

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

  describe('when an IP allow list refuses the token', () => {
    const message =
      'Although you appear to have the correct authorization credentials, the `foo` organization has an IP allow list enabled, and 203.0.113.1 is not permitted to access this resource.';
    const api = 'https://api.github.com';

    beforeEach(() => {
      hostRules.add({ hostType: 'github', token: 'abc' });
    });

    function refuseGraphql(registryApi = api, path = '/graphql'): void {
      httpMock
        .scope(registryApi, { reqheaders: { authorization: 'token abc' } })
        .post(path)
        .reply(200, {
          data: { repository: null },
          errors: [{ type: 'FORBIDDEN', message }],
        });
    }

    describe('queryTags', () => {
      it('reads the tags without a token', async () => {
        refuseGraphql();
        httpMock
          .scope(api, { badheaders: ['authorization'] })
          .get('/repos/foo/bar/tags?per_page=100')
          .reply(200, [
            { name: 'v1.1.0', commit: { sha: 'abc123' } },
            { name: 'invalid' },
            { name: 'v1.0.0', commit: { sha: 'def456' } },
          ]);

        const res = await queryTags({ packageName: 'foo/bar' }, http);

        expect(res).toEqual([
          { version: 'v1.1.0', gitRef: 'v1.1.0', hash: 'abc123' },
          { version: 'v1.0.0', gitRef: 'v1.0.0', hash: 'def456' },
        ]);
        expect(httpMock.allUsed()).toBeTrue();
      });

      it('reads all pages of the tags', async () => {
        refuseGraphql();
        httpMock
          .scope(api, { badheaders: ['authorization'] })
          .get('/repos/foo/bar/tags?per_page=100')
          .reply(200, [{ name: 'v2.0.0', commit: { sha: 'abc123' } }], {
            link: `<${api}/repos/foo/bar/tags?per_page=100&page=2>; rel="next", <${api}/repos/foo/bar/tags?per_page=100&page=2>; rel="last"`,
          })
          .get('/repos/foo/bar/tags?per_page=100&page=2')
          .reply(200, [{ name: 'v1.0.0', commit: { sha: 'def456' } }]);

        const res = await queryTags({ packageName: 'foo/bar' }, http);

        expect(res.map(({ version }) => version)).toEqual(['v2.0.0', 'v1.0.0']);
      });

      it('reads the tags without a token if GraphQL answers with 403', async () => {
        httpMock
          .scope(api, { reqheaders: { authorization: 'token abc' } })
          .post('/graphql')
          .reply(403, { message });
        httpMock
          .scope(api, { badheaders: ['authorization'] })
          .get('/repos/foo/bar/tags?per_page=100')
          .reply(200, [{ name: 'v1.0.0', commit: { sha: 'abc123' } }]);

        const res = await queryTags({ packageName: 'foo/bar' }, http);

        expect(res).toEqual([
          { version: 'v1.0.0', gitRef: 'v1.0.0', hash: 'abc123' },
        ]);
        expect(httpMock.allUsed()).toBeTrue();
      });

      it('reads the tags on GitHub Enterprise Server', async () => {
        const ghe = 'https://ghe.example.com';
        refuseGraphql(ghe, '/api/graphql');
        httpMock
          .scope(ghe, { badheaders: ['authorization'] })
          .get('/api/v3/repos/foo/bar/tags?per_page=100')
          .reply(200, [{ name: 'v1.0.0', commit: { sha: 'abc123' } }]);

        const res = await queryTags(
          { packageName: 'foo/bar', registryUrl: ghe },
          http,
        );

        expect(res).toHaveLength(1);
      });

      it.each`
        description                       | status | body
        ${'the repository is not public'} | ${404} | ${{ message: 'Not Found' }}
        ${'the rate limit is exhausted'}  | ${403} | ${{ message: 'API rate limit exceeded for 203.0.113.1.' }}
      `(
        'throws the original error if $description',
        async ({ status, body }: { status: number; body: object }) => {
          refuseGraphql();
          httpMock
            .scope(api)
            .get('/repos/foo/bar/tags?per_page=100')
            .reply(status, body);

          const err = await queryTags({ packageName: 'foo/bar' }, http).catch(
            (e: unknown) => e,
          );

          expect(err).toBeInstanceOf(GithubIpAllowListError);
          expect(err).toHaveProperty('message', message);
        },
      );

      it('throws other errors without reading the tags again', async () => {
        httpMock
          .scope(api)
          .post('/graphql')
          .reply(200, { errors: [{ message: 'Something else' }] });

        await expect(
          queryTags({ packageName: 'foo/bar' }, http),
        ).rejects.toThrow('Something else');
        expect(httpMock.allUsed()).toBeTrue();
      });
    });

    describe('queryReleases', () => {
      it('reads the releases without a token', async () => {
        refuseGraphql();
        httpMock
          .scope(api, { badheaders: ['authorization'] })
          .get('/repos/foo/bar/releases?per_page=100')
          .reply(200, [
            {
              tag_name: 'v2.0.0-rc.1',
              published_at: '2024-02-01T00:00:00Z',
              draft: false,
              prerelease: true,
              html_url: 'https://github.com/foo/bar/releases/tag/v2.0.0-rc.1',
              id: 3,
              name: 'Release candidate',
              body: 'Notes of the candidate',
            },
            {
              tag_name: 'v1.1.0',
              published_at: '2024-01-01T00:00:00Z',
              draft: false,
              prerelease: false,
              html_url: 'https://github.com/foo/bar/releases/tag/v1.1.0',
              id: 2,
              name: null,
              body: null,
            },
            {
              tag_name: 'v1.2.0',
              published_at: null,
              draft: true,
              prerelease: false,
              html_url: 'https://github.com/foo/bar/releases/tag/v1.2.0',
              id: 4,
              name: null,
              body: null,
            },
          ]);

        const res = await queryReleases({ packageName: 'foo/bar' }, http);

        expect(res).toEqual([
          {
            version: 'v2.0.0-rc.1',
            releaseTimestamp: '2024-02-01T00:00:00.000Z',
            url: 'https://github.com/foo/bar/releases/tag/v2.0.0-rc.1',
            id: 3,
            name: 'Release candidate',
            description: 'Notes of the candidate',
            isStable: false,
          },
          {
            version: 'v1.1.0',
            releaseTimestamp: '2024-01-01T00:00:00.000Z',
            url: 'https://github.com/foo/bar/releases/tag/v1.1.0',
            id: 2,
          },
        ]);
        expect(httpMock.allUsed()).toBeTrue();
      });

      it('throws the original error if the releases can not be read', async () => {
        refuseGraphql();
        httpMock
          .scope(api)
          .get('/repos/foo/bar/releases?per_page=100')
          .reply(404);

        await expect(
          queryReleases({ packageName: 'foo/bar' }, http),
        ).rejects.toThrow(message);
      });
    });
  });
});
