import delay from 'delay';
import * as httpMock from '../../../test/httpMock';
import { getName } from '../../../test/util';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_FAILURE,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import { clearRepoCache } from '../cache';
import { GithubHttp, handleGotError, setBaseUrl } from './github';

const githubApiHost = 'https://api.github.com';

jest.mock('delay');

describe(getName(__filename), () => {
  let githubApi;
  beforeEach(() => {
    githubApi = new GithubHttp();
    setBaseUrl(githubApiHost);
    jest.resetAllMocks();
    delete global.appMode;
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
    clearRepoCache();
  });

  describe('HTTP', () => {
    function getError(errOrig: any): Error {
      try {
        return handleGotError(errOrig, `${githubApiHost}/some-url`, {});
      } catch (err) {
        return err;
      }
      return null;
    }

    beforeEach(() => {
      (delay as any).mockImplementation(() => Promise.resolve());
    });

    it('supports app mode', async () => {
      httpMock.scope(githubApiHost).get('/some-url').reply(200);
      global.appMode = true;
      await githubApi.get('/some-url', {
        headers: { accept: 'some-accept' },
      });
      const [req] = httpMock.getTrace();
      expect(req).toBeDefined();
      expect(req.headers.accept).toBe(
        'application/vnd.github.machine-man-preview+json, some-accept'
      );
    });
    it('strips v3 for graphql', async () => {
      httpMock
        .scope('https://ghe.mycompany.com')
        .post('/graphql')
        .reply(200, {});
      setBaseUrl('https://ghe.mycompany.com/api/v3/');
      await githubApi.postJson('/graphql', {
        body: {},
      });
      const [req] = httpMock.getTrace();
      expect(req).toBeDefined();
      expect(req.url.includes('/v3')).toBe(false);
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
    it('should throw rate limit exceeded', () => {
      const e = getError({
        statusCode: 403,
        message:
          'Error updating branch: API rate limit exceeded for installation ID 48411. (403)',
      });
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_RATE_LIMIT_EXCEEDED);
    });
    it('should throw Bad credentials', () => {
      const e = getError({
        statusCode: 401,
        message: 'Bad credentials. (401)',
      });
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_BAD_CREDENTIALS);
    });
    it('should throw platform failure', () => {
      const e = getError({
        statusCode: 401,
        message: 'Bad credentials. (401)',
        headers: {
          'x-ratelimit-limit': '60',
        },
      });
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_FAILURE);
    });
    it('should throw platform failure for ENOTFOUND, ETIMEDOUT or EAI_AGAIN', () => {
      const codes = ['ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'];
      for (let idx = 0; idx < codes.length; idx += 1) {
        const code = codes[idx];
        const e = getError({
          name: 'RequestError',
          code,
        });
        expect(e).toBeDefined();
        expect(e.message).toEqual(PLATFORM_FAILURE);
      }
    });
    it('should throw platform failure for 500', () => {
      const e = getError({
        statusCode: 500,
        message: 'Internal Server Error',
      });
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_FAILURE);
    });
    it('should throw platform failure ParseError', () => {
      const e = getError({
        name: 'ParseError',
      });
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_FAILURE);
    });
    it('should throw for unauthorized integration', () => {
      const e = getError({
        statusCode: 403,
        message: 'Resource not accessible by integration (403)',
      });
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_INTEGRATION_UNAUTHORIZED);
    });
    it('should throw for unauthorized integration', () => {
      const gotErr = {
        statusCode: 403,
        body: { message: 'Upgrade to GitHub Pro' },
      };
      const e = getError(gotErr);
      expect(e).toBeDefined();
      expect(e).toBe(gotErr);
    });
    it('should throw on abuse', () => {
      const gotErr = {
        statusCode: 403,
        message: 'You have triggered an abuse detection mechanism',
      };
      const e = getError(gotErr);
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_RATE_LIMIT_EXCEEDED);
    });
    it('should throw on repository change', () => {
      const gotErr = {
        statusCode: 422,
        body: {
          message: 'foobar',
          errors: [{ code: 'invalid' }],
        },
      };
      const e = getError(gotErr);
      expect(e).toBeDefined();
      expect(e.message).toEqual(REPOSITORY_CHANGED);
    });
    it('should throw platform failure on 422 response', () => {
      const gotErr = {
        statusCode: 422,
        message: 'foobar',
      };
      const e = getError(gotErr);
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_FAILURE);
    });
    it('should throw original error when failed to add reviewers', () => {
      const gotErr = {
        statusCode: 422,
        message: 'Review cannot be requested from pull request author.',
      };
      const e = getError(gotErr);
      expect(e).toBeDefined();
      expect(e).toStrictEqual(gotErr);
    });
    it('should throw original error of unknown type', () => {
      const gotErr = {
        statusCode: 418,
        message: 'Sorry, this is a teapot',
      };
      const e = getError(gotErr);
      expect(e).toBe(gotErr);
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

    it('supports app mode', async () => {
      httpMock.scope(githubApiHost).post('/graphql').reply(200, {});
      global.appMode = true;
      await githubApi.getGraphqlNodes(query, 'testItem', { paginate: false });
      const [req] = httpMock.getTrace();
      expect(req).toBeDefined();
      expect(req.headers.accept).toBe(
        'application/vnd.github.machine-man-preview+json, application/vnd.github.merge-info-preview+json'
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
        await githubApi.getGraphqlNodes(query, 'testItem', { paginate: false })
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
        await githubApi.getGraphqlNodes(query, 'testItem', { paginate: false })
      ).toEqual([]);
    });
    it('throws errors for invalid responses', async () => {
      httpMock.scope(githubApiHost).post('/graphql').reply(418);
      await expect(
        githubApi.getGraphqlNodes(query, 'someItem', {
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
      await githubApi.getGraphqlNodes(query, 'testItem');
      expect(httpMock.getTrace()).toHaveLength(7);
    });
    it('retrieves all data from all pages', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .post('/graphql')
        .reply(200, {
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
        })
        .post('/graphql')
        .reply(200, {
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
        });

      const items = await githubApi.getGraphqlNodes(query, 'testItem');
      expect(httpMock.getTrace()).toHaveLength(3);
      expect(items.length).toEqual(3);
    });
  });
});
