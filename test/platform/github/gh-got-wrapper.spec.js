const ghGot = require('gh-got');
const delay = require('delay');
const get = require('../../../lib/platform/github/gh-got-wrapper');

jest.mock('gh-got');
jest.mock('delay');

describe('platform/gh-got-wrapper', () => {
  const body = ['a', 'b'];
  beforeEach(() => {
    jest.resetAllMocks();
    get.reset();
    delete global.appMode;
    delay.mockImplementation(() => Promise.resolve());
  });
  it('supports app mode', async () => {
    global.appMode = true;
    await get('some-url', { headers: { accept: 'some-accept' } });
    expect(ghGot.mock.calls[0][1].headers.accept).toBe(
      'application/vnd.github.machine-man-preview+json, some-accept'
    );
  });
  it('strips v3 for graphql', async () => {
    ghGot.mockImplementationOnce(() => ({
      body: '{"data":{',
    }));
    await get.post('graphql', {
      endpoint: 'https://ghe.mycompany.com/api/v3/',
      body: 'abc',
    });
    expect(ghGot.mock.calls[0][1].baseUrl).toEqual(
      'https://ghe.mycompany.com/api/'
    );
  });
  it('paginates', async () => {
    ghGot.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="last"',
      },
      body: ['a'],
    });
    ghGot.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="last"',
      },
      body: ['b', 'c'],
    });
    ghGot.mockReturnValueOnce({
      headers: {},
      body: ['d'],
    });
    const res = await get('some-url', { paginate: true });
    expect(res.body).toEqual(['a', 'b', 'c', 'd']);
    expect(ghGot.mock.calls).toHaveLength(3);
  });
  it('attempts to paginate', async () => {
    ghGot.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"',
      },
      body: ['a'],
    });
    ghGot.mockReturnValueOnce({
      headers: {},
      body: ['b'],
    });
    const res = await get('some-url', { paginate: true });
    expect(res.body).toHaveLength(1);
    expect(ghGot.mock.calls).toHaveLength(1);
  });
  it('should throw rate limit exceeded', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message:
          'Error updating branch: API rate limit exceeded for installation ID 48411. (403)',
      })
    );
    let e;
    try {
      await get('some-url');
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
  });
  it('should throw Bad credentials', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 401,
        message: 'Bad credentials. (401)',
      })
    );
    let e;
    try {
      await get('some-url');
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
    expect(e.message).toEqual('bad-credentials');
  });
  it('should throw platform failure', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 401,
        message: 'Bad credentials. (401)',
        headers: {
          'x-ratelimit-limit': '60',
        },
      })
    );
    let e;
    try {
      await get('some-url');
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
  });
  it('should throw platform failure ENOTFOUND', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        name: 'RequestError',
        code: 'ENOTFOUND',
      })
    );
    let e;
    try {
      await get('some-url', {}, 0);
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
  });
  it('should throw platform failure for 500', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 500,
        message: 'Internal Server Error',
      })
    );
    let e;
    try {
      await get('some-url', {}, 0);
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
  });
  it('should throw for blob size', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message:
          'This API returns blobs up to 1 MB in size. The requested blob is too large to fetch via the API, but you can use the Git Data API to request blobs up to 100 MB in size. (403)',
      })
    );
    let e;
    try {
      await get('some-url');
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
    expect(e).toMatchSnapshot();
  });
  it('should retry 502s', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() => ({
      body,
    }));
    const res = await get('some-url');
    expect(res.body).toEqual(body);
  });
  it('should retry 502s until success', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() => ({
      body,
    }));
    const res = await get('some-url');
    expect(ghGot.mock.calls).toHaveLength(3);
    expect(res.body).toEqual(body);
  });
  it('should retry until failure', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message: 'Bad bot.',
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message:
          'You have triggered an abuse detection mechanism. Please wait a few minutes before you try again.',
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 404,
      })
    );
    let err;
    try {
      await get('some-url');
    } catch (e) {
      err = e;
    }
    expect(err.statusCode).toBe(404);
  });
  it('should give up after 5 retries', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 500,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 500,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message: 'Bad bot.',
      })
    );
    let err;
    try {
      await get('some-url');
    } catch (e) {
      err = e;
    }
    expect(err.statusCode).toBe(403);
  });
  it('should retry posts', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 502,
      })
    );
    ghGot.mockImplementationOnce(() => ({
      body,
    }));
    const res = await get.post('some-url');
    expect(res.body).toEqual(body);
  });
  it('returns cached', async () => {
    get.reset();
    ghGot.mockReturnValueOnce({
      body: {},
    });
    const res1 = await get('repos/foo');
    const res2 = await get('repos/foo');
    expect(res1).toEqual(res2);
  });
  it('should throw platform failure ParseError', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        name: 'ParseError',
      })
    );
    let e;
    try {
      await get('some-url', {}, 0);
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
  });
  it('should throw for unauthorized integration', async () => {
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message: 'Resource not accessible by integration (403)',
      })
    );
    let e;
    try {
      await get('some-url', {}, 0);
    } catch (err) {
      e = err;
    }
    expect(e).toBeDefined();
    expect(e.message).toEqual('integration-unauthorized');
  });
});
