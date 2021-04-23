import nock from 'nock';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import {
  EXTERNAL_HOST_ERROR,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import * as hostRules from '../host-rules';
import { GithubHttp, setBaseUrl } from './github';

const githubApiHost = 'https://api.github.com';

describe(getName(__filename), () => {
  let githubApi: GithubHttp;
  beforeEach(() => {
    githubApi = new GithubHttp();
    setBaseUrl(githubApiHost);
    jest.resetAllMocks();
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
    hostRules.clear();
  });

  describe('HTTP', () => {
    it('supports app mode', async () => {
      hostRules.add({ hostType: 'github', token: 'x-access-token:abc123' });
      httpMock.scope(githubApiHost).get('/some-url').reply(200);
      await githubApi.get('/some-url', {
        headers: { accept: 'some-accept' },
      });
      const [req] = httpMock.getTrace();
      expect(req).toBeDefined();
      expect(req.headers.accept).toBe(
        'some-accept, application/vnd.github.machine-man-preview+json'
      );
    });
    it('paginates', async () => {
      const url = '/some-url';
      httpMock
        .scope(githubApiHost)
        .get(url)
        .reply(200, ['a'], {
          link: `<${url}?page=2>; rel="next", <${url}?page=3>; rel="last"`,
        })
        .get(`${url}?page=2`)
        .reply(200, ['b', 'c'], {
          link: `<${url}?page=3>; rel="next", <${url}?page=3>; rel="last"`,
        })
        .get(`${url}?page=3`)
        .reply(200, ['d']);
      const res = await githubApi.getJson('some-url', { paginate: true });
      expect(res.body).toEqual(['a', 'b', 'c', 'd']);
      const trace = httpMock.getTrace();
      expect(trace).toHaveLength(3);
    });
    it('attempts to paginate', async () => {
      const url = '/some-url';
      httpMock
        .scope(githubApiHost)
        .get(url)
        .reply(200, ['a'], {
          link: `<${url}?page=34>; rel="last"`,
        });
      const res = await githubApi.getJson('some-url', { paginate: true });
      expect(res).toBeDefined();
      expect(res.body).toEqual(['a']);
      const trace = httpMock.getTrace();
      expect(trace).toHaveLength(1);
    });
    describe('handleGotError', () => {
      async function fail(
        code: number,
        body: any = undefined,
        headers: nock.ReplyHeaders = undefined
      ) {
        const url = '/some-url';
        httpMock
          .scope(githubApiHost)
          .get(url)
          .reply(
            code,
            function reply() {
              // https://github.com/nock/nock/issues/1979
              if (typeof body === 'object' && 'message' in body) {
                (this.req as any).response.statusMessage = body?.message;
              }
              return body;
            },
            headers
          );
        await githubApi.getJson(url);
      }
      async function failWithError(error: string | Record<string, unknown>) {
        const url = '/some-url';
        httpMock.scope(githubApiHost).get(url).replyWithError(error);
        await githubApi.getJson(url);
      }

      it('should throw Not found', async () => {
        await expect(fail(404)).rejects.toThrow(
          'Response code 404 (Not Found)'
        );
      });
      it('should throw rate limit exceeded', async () => {
        await expect(
          fail(403, {
            message:
              'Error updating branch: API rate limit exceeded for installation ID 48411. (403)',
          })
        ).rejects.toThrow(PLATFORM_RATE_LIMIT_EXCEEDED);
      });
      it('should throw Bad credentials', async () => {
        await expect(
          fail(401, { message: 'Bad credentials. (401)' })
        ).rejects.toThrow(PLATFORM_BAD_CREDENTIALS);
      });
      it('should throw platform failure', async () => {
        await expect(
          fail(
            401,
            { message: 'Bad credentials. (401)' },
            {
              'x-ratelimit-limit': '60',
            }
          )
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });
      it('should throw platform failure for ENOTFOUND, ETIMEDOUT or EAI_AGAIN', async () => {
        const codes = ['ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'];
        for (let idx = 0; idx < codes.length; idx += 1) {
          const code = codes[idx];
          await expect(failWithError({ code })).rejects.toThrow(
            EXTERNAL_HOST_ERROR
          );
        }
      });
      it('should throw platform failure for 500', async () => {
        await expect(fail(500)).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });
      it('should throw platform failure ParseError', async () => {
        await expect(fail(200, '{{')).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });
      it('should throw for unauthorized integration', async () => {
        await expect(
          fail(403, { message: 'Resource not accessible by integration (403)' })
        ).rejects.toThrow(PLATFORM_INTEGRATION_UNAUTHORIZED);
      });
      it('should throw for unauthorized integration2', async () => {
        await expect(
          fail(403, { message: 'Upgrade to GitHub Pro' })
        ).rejects.toThrow('Upgrade to GitHub Pro');
      });
      it('should throw on abuse', async () => {
        await expect(
          fail(403, {
            message: 'You have triggered an abuse detection mechanism',
          })
        ).rejects.toThrow(PLATFORM_RATE_LIMIT_EXCEEDED);
      });
      it('should throw on repository change', async () => {
        await expect(
          fail(422, {
            message: 'foobar',
            errors: [{ code: 'invalid' }],
          })
        ).rejects.toThrow(REPOSITORY_CHANGED);
      });
      it('should throw platform failure on 422 response', async () => {
        await expect(
          fail(422, {
            message: 'foobar',
          })
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });
      it('should throw original error when failed to add reviewers', async () => {
        await expect(
          fail(422, {
            message: 'Review cannot be requested from pull request author.',
          })
        ).rejects.toThrow(
          'Review cannot be requested from pull request author.'
        );
      });
      it('should throw original error when pull requests aleady existed', async () => {
        await expect(
          fail(422, {
            message: 'Validation error',
            errors: [{ message: 'A pull request already exists' }],
          })
        ).rejects.toThrow('Validation error');
      });
      it('should throw original error of unknown type', async () => {
        await expect(
          fail(418, {
            message: 'Sorry, this is a teapot',
          })
        ).rejects.toThrow('Sorry, this is a teapot');
      });
    });
  });

  describe('GraphQL', () => {
    const query = `
      query {
        repository(owner: "testOwner", name: "testName") {
          testItem (orderBy: {field: UPDATED_AT, direction: DESC}, filterBy: {createdBy: "someone"}) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              number state title body
            }
          }
        }
      }`;

    const page1 = {
      data: {
        repository: {
          testItem: {
            pageInfo: {
              endCursor: 'cursor1',
              hasNextPage: true,
            },
            nodes: [
              {
                number: 1,
                state: 'OPEN',
                title: 'title-1',
                body: 'the body 1',
              },
            ],
          },
        },
      },
    };

    const page2 = {
      data: {
        repository: {
          testItem: {
            pageInfo: {
              endCursor: 'cursor2',
              hasNextPage: true,
            },
            nodes: [
              {
                number: 2,
                state: 'CLOSED',
                title: 'title-2',
                body: 'the body 2',
              },
            ],
          },
        },
      },
    };

    const page3 = {
      data: {
        repository: {
          testItem: {
            pageInfo: {
              endCursor: 'cursor3',
              hasNextPage: false,
            },
            nodes: [
              {
                number: 3,
                state: 'OPEN',
                title: 'title-3',
                body: 'the body 3',
              },
            ],
          },
        },
      },
    };

    it('strips path from baseUrl', async () => {
      setBaseUrl('https://ghe.mycompany.com/api/v3/');
      const repository = { foo: 'foo', bar: 'bar' };
      httpMock
        .scope('https://ghe.mycompany.com')
        .post('/api/graphql')
        .reply(200, { data: { repository } });
      await githubApi.queryRepo(query);
      const [req] = httpMock.getTrace();
      expect(req).toBeDefined();
      expect(req.url).toEqual('https://ghe.mycompany.com/api/graphql');
    });
    it('supports app mode', async () => {
      hostRules.add({ hostType: 'github', token: 'x-access-token:abc123' });
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, { data: { repository: { testItem: 'XXX' } } });
      await githubApi.queryRepoField(query, 'testItem', { paginate: false });
      const [req] = httpMock.getTrace();
      expect(req).toBeDefined();
      expect(req.headers.accept).toBe(
        'application/vnd.github.machine-man-preview+json'
      );
    });
    it('returns empty array for undefined data', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
          data: {
            someprop: 'someval',
          },
        });
      expect(
        await githubApi.queryRepoField(query, 'testItem', { paginate: false })
      ).toEqual([]);
    });
    it('returns empty array for undefined data.', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
          data: { repository: { otherField: 'someval' } },
        });
      expect(
        await githubApi.queryRepoField(query, 'testItem', { paginate: false })
      ).toEqual([]);
    });
    it('throws errors for invalid responses', async () => {
      httpMock.scope(githubApiHost).post('/graphql').reply(418);
      await expect(
        githubApi.queryRepoField(query, 'someItem', {
          paginate: false,
        })
      ).rejects.toThrow("Response code 418 (I'm a Teapot)");
    });
    it('halves node count and retries request', async () => {
      httpMock
        .scope(githubApiHost)
        .persist()
        .post('/graphql')
        .reply(200, {
          data: {
            someprop: 'someval',
          },
        });
      await githubApi.queryRepoField(query, 'testItem');
      expect(httpMock.getTrace()).toHaveLength(7);
    });
    it('queryRepo', async () => {
      const repository = {
        foo: 'foo',
        bar: 'bar',
      };
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, { data: { repository } });

      const result = await githubApi.queryRepo(query);
      expect(httpMock.getTrace()).toHaveLength(1);
      expect(result).toStrictEqual(repository);
    });
    it('queryRepoField', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, page1)
        .post('/graphql')
        .reply(200, page2)
        .post('/graphql')
        .reply(200, page3);

      const items = await githubApi.queryRepoField(query, 'testItem');
      expect(httpMock.getTrace()).toHaveLength(3);
      expect(items).toHaveLength(3);
    });
    it('limit result size', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, page1)
        .post('/graphql')
        .reply(200, page2);

      const items = await githubApi.queryRepoField(query, 'testItem', {
        limit: 2,
      });
      expect(httpMock.getTrace()).toHaveLength(2);
      expect(items).toHaveLength(2);
    });
    it('shrinks items count on 50x', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, page1)
        .post('/graphql')
        .reply(500)
        .post('/graphql')
        .reply(200, page2)
        .post('/graphql')
        .reply(200, page3);

      const items = await githubApi.queryRepoField(query, 'testItem');
      expect(items).toHaveLength(3);

      const trace = httpMock.getTrace();
      expect(trace).toHaveLength(4);
      expect(trace).toMatchSnapshot();
    });
    it('throws on 50x if count < 10', async () => {
      httpMock.scope(githubApiHost).post('/graphql').reply(500);
      await expect(
        githubApi.queryRepoField(query, 'testItem', {
          count: 9,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
});
