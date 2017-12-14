const get = require('../../../lib/platform/github/gh-got-wrapper');
const ghGot = require('gh-got');

jest.mock('gh-got');

describe('platform/gh-got-wrapper', () => {
  const body = ['a', 'b'];
  beforeEach(() => {
    jest.resetAllMocks();
    get.setAppMode(false);
  });
  it('supports app mode', async () => {
    get.setAppMode(true);
    await get('some-url', { headers: { accept: 'some-accept' } });
    expect(ghGot.mock.calls[0][1].headers.accept).toBe(
      'application/vnd.github.machine-man-preview+json, some-accept'
    );
  });
  it('paginates', async () => {
    ghGot.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"',
      },
      body: ['a'],
    });
    ghGot.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"',
      },
      body: ['b', 'c'],
    });
    ghGot.mockReturnValueOnce({
      headers: {},
      body: ['d'],
    });
    const res = await get('some-url', { paginate: true });
    expect(res.body).toHaveLength(4);
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
        message: 'API rate limit exceeded for x.',
      })
    );
    ghGot.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 401,
        message: 'Bad credentials',
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
        message: 'API rate limit exceeded for x.',
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
});
