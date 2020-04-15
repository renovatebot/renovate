import _got from '../got';
import { GithubHttp, setBaseUrl } from './github';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_FAILURE,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';

jest.mock('../../util/got');
const got: any = _got;

describe('Github HTTP', () => {
  async function makeError(http: GithubHttp): Promise<Error> {
    try {
      await http.getJson('some-url', {});
    } catch (err) {
      return err;
    }
    return null;
  }

  let http: GithubHttp;
  beforeEach(() => {
    jest.resetAllMocks();
    http = new GithubHttp();
    delete global.appMode;
  });

  it('supports app mode', async () => {
    got.mockImplementationOnce(() => ({}));
    global.appMode = true;
    await http.getJson('some-url', {
      headers: { accept: 'some-accept' },
    });
    expect(got.mock.calls[0][1].headers.accept).toBe(
      'application/vnd.github.machine-man-preview+json, some-accept'
    );
  });

  it('strips v3 for graphql', async () => {
    got.mockImplementation(() => ({
      body: {},
    }));
    setBaseUrl('https://ghe.mycompany.com/api/v3/');
    await http.postJson('graphql', {
      body: 'abc',
    });
    expect(got.mock.calls[0][0].includes('/v3')).toBe(false);
  });

  it('paginates', async () => {
    got.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="last"',
      },
      body: ['a'],
    });
    got.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="last"',
      },
      body: ['b', 'c'],
    });
    got.mockReturnValueOnce({
      headers: {},
      body: ['d'],
    });
    const res = await http.getJson('some-url', { paginate: true });
    expect(res.body).toEqual(['a', 'b', 'c', 'd']);
    expect(got).toHaveBeenCalledTimes(3);
  });

  it('attempts to paginate', async () => {
    got.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"',
      },
      body: ['a'],
    });
    got.mockReturnValueOnce({
      headers: {},
      body: ['b'],
    });
    const res = await http.getJson('some-url', { paginate: true });
    expect(res.body).toHaveLength(1);
    expect(got).toHaveBeenCalledTimes(1);
  });

  it('should throw rate limit exceeded', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message:
          'Error updating branch: API rate limit exceeded for installation ID 48411. (403)',
      })
    );
    await expect(http.getJson('some-url')).rejects.toThrow();
  });

  it('should throw Bad credentials', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 401,
        message: 'Bad credentials. (401)',
      })
    );
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(PLATFORM_BAD_CREDENTIALS);
  });

  it('should throw platform failure', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 401,
        message: 'Bad credentials. (401)',
        headers: {
          'x-ratelimit-limit': '60',
        },
      })
    );
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(PLATFORM_FAILURE);
  });

  it('should throw platform failure for ENOTFOUND, ETIMEDOUT or EAI_AGAIN', async () => {
    const codes = ['ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'];
    for (let idx = 0; idx < codes.length; idx += 1) {
      const code = codes[idx];
      got.mockImplementationOnce(() =>
        Promise.reject({
          name: 'RequestError',
          code,
        })
      );
      const e = await makeError(http);
      expect(e).toBeDefined();
      expect(e.message).toEqual(PLATFORM_FAILURE);
    }
  });

  it('should throw platform failure for 500', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 500,
        message: 'Internal Server Error',
      })
    );
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(PLATFORM_FAILURE);
  });

  it('should throw platform failure ParseError', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        name: 'ParseError',
      })
    );
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(PLATFORM_FAILURE);
  });

  it('should throw for unauthorized integration', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message: 'Resource not accessible by integration (403)',
      })
    );
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(PLATFORM_INTEGRATION_UNAUTHORIZED);
  });

  it('should throw for unauthorized integration', async () => {
    const gotErr = {
      statusCode: 403,
      body: { message: 'Upgrade to GitHub Pro' },
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e).toBe(gotErr);
  });

  it('should throw on abuse', async () => {
    const gotErr = {
      statusCode: 403,
      message: 'You have triggered an abuse detection mechanism',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(PLATFORM_RATE_LIMIT_EXCEEDED);
  });

  it('should throw on repository change', async () => {
    const gotErr = {
      statusCode: 422,
      body: {
        message: 'foobar',
        errors: [{ code: 'invalid' }],
      },
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(REPOSITORY_CHANGED);
  });

  it('should throw platform failure on 422 response', async () => {
    const gotErr = {
      statusCode: 422,
      message: 'foobar',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e.message).toEqual(PLATFORM_FAILURE);
  });

  it('should throw original error when failed to add reviewers', async () => {
    const gotErr = {
      statusCode: 422,
      message: 'Review cannot be requested from pull request author.',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await makeError(http);
    expect(e).toBeDefined();
    expect(e).toStrictEqual(gotErr);
  });

  it('should throw original error of unknown type', async () => {
    const gotErr = {
      statusCode: 418,
      message: 'Sorry, this is a teapot',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await makeError(http);
    expect(e).toBe(gotErr);
  });
});

describe('Github GraphQL', () => {
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

  async function makeError(http: GithubHttp, q: string, f: string) {
    let error;
    try {
      await http.getGraphqlNodes(q, f);
    } catch (err) {
      error = err;
    }
    return error;
  }

  let http: GithubHttp;
  beforeEach(() => {
    jest.resetAllMocks();
    http = new GithubHttp();
    delete global.appMode;
  });

  it('supports app mode', async () => {
    global.appMode = true;
    got.mockReturnValue({
      body: {
        data: {
          someprop: 'someval',
        },
      },
    });
    await http.getGraphqlNodes(query, 'testItem');
    expect(got.mock.calls[0][1].headers.accept).toEqual(
      'application/vnd.github.machine-man-preview+json, application/vnd.github.merge-info-preview+json'
    );
  });
  it('returns empty array for undefined data', async () => {
    got.mockReturnValue({
      body: {
        data: {
          someprop: 'someval',
        },
      },
    });
    expect(await http.getGraphqlNodes(query, 'testItem')).toEqual([]);
  });
  it('returns empty array for undefined data.', async () => {
    got.mockReturnValue({
      body: {
        data: { repository: { otherField: 'someval' } },
      },
    });
    expect(await http.getGraphqlNodes(query, 'testItem')).toEqual([]);
  });
  it('throws errors for invalid responses', async () => {
    const gotErr = {
      statusCode: 418,
      message: 'Sorry, this is a teapot',
    };
    got.mockImplementationOnce(() => Promise.reject(gotErr));
    const e = await makeError(http, query, 'someItem');
    expect(e).toBe(gotErr);
  });
  it('halves node count and retries request', async () => {
    got.mockReturnValue({
      body: {
        data: {
          someprop: 'someval',
        },
      },
    });

    await http.getGraphqlNodes(query, 'testItem');
    expect(got).toHaveBeenCalledTimes(7);
  });
  it('retrieves all data from all pages', async () => {
    got.mockReturnValueOnce({
      body: {
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
      },
    });

    got.mockReturnValueOnce({
      body: {
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
      },
    });

    got.mockReturnValueOnce({
      body: {
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
      },
    });

    const items = await http.getGraphqlNodes(query, 'testItem');
    expect(got).toHaveBeenCalledTimes(3);
    expect(items.length).toEqual(3);
  });
  it('can avoid pagination', async () => {
    got.mockReturnValueOnce({
      body: {
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
      },
    });

    const items = await http.getGraphqlNodes(query, 'testItem', {
      paginate: false,
    });
    expect(got).toHaveBeenCalledTimes(1);
    expect(items.length).toEqual(1);
  });
});
