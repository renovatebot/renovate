import delay from 'delay';
import { Response } from 'got';
import _got from '../../../lib/util/got';
import { api } from '../../../lib/platform/github/gh-got-wrapper';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_RATE_LIMIT_EXCEEDED,
} from '../../../lib/constants/error-messages';

jest.mock('../../../lib/util/got');
jest.mock('delay');

const got: any = _got;

const get: <T extends object = any>(
  path: string,
  options?: any,
  okToRetry?: boolean
) => Promise<Response<T>> = api as any;

async function getError(): Promise<Error> {
  try {
    await get('some-url', {}, false);
  } catch (err) {
    return err;
  }
  return null;
}

describe('platform/gh-got-wrapper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete global.appMode;
    (delay as any).mockImplementation(() => Promise.resolve());
  });
  it('supports app mode', async () => {
    global.appMode = true;
    await api.get('some-url', { headers: { accept: 'some-accept' } });
    expect(got.mock.calls[0][1].headers.accept).toBe(
      'application/vnd.github.machine-man-preview+json, some-accept'
    );
  });
  it('strips v3 for graphql', async () => {
    got.mockImplementationOnce(() => ({
      body: '{"data":{',
    }));
    api.setBaseUrl('https://ghe.mycompany.com/api/v3/');
    await api.post('graphql', {
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
    const res = await api.get('some-url', { paginate: true });
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
    const res = await api.get('some-url', { paginate: true });
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
    await expect(api.get('some-url')).rejects.toThrow();
  });
  it('should throw Bad credentials', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 401,
        message: 'Bad credentials. (401)',
      })
    );
    const e = await getError();
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
    const e = await getError();
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
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
      const e = await getError();
      expect(e).toBeDefined();
      expect(e.message).toEqual('platform-failure');
    }
  });
  it('should throw platform failure for 500', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 500,
        message: 'Internal Server Error',
      })
    );
    const e = await getError();
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
  });
  it('should throw platform failure ParseError', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        name: 'ParseError',
      })
    );
    const e = await getError();
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
  });
  it('should throw for unauthorized integration', async () => {
    got.mockImplementationOnce(() =>
      Promise.reject({
        statusCode: 403,
        message: 'Resource not accessible by integration (403)',
      })
    );
    const e = await getError();
    expect(e).toBeDefined();
    expect(e.message).toEqual('integration-unauthorized');
  });
  it('should throw for unauthorized integration', async () => {
    const gotErr = {
      statusCode: 403,
      body: { message: 'Upgrade to GitHub Pro' },
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await getError();
    expect(e).toBeDefined();
    expect(e).toBe(gotErr);
  });
  it('should throw on abuse', async () => {
    const gotErr = {
      statusCode: 403,
      message: 'You have triggered an abuse detection mechanism',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await getError();
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
    const e = await getError();
    expect(e).toBeDefined();
    expect(e.message).toEqual('repository-changed');
  });
  it('should throw platform failure on 422 response', async () => {
    const gotErr = {
      statusCode: 422,
      message: 'foobar',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await getError();
    expect(e).toBeDefined();
    expect(e.message).toEqual('platform-failure');
  });
  it('should throw original error when failed to add reviewers', async () => {
    const gotErr = {
      statusCode: 422,
      message: 'Review cannot be requested from pull request author.',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await getError();
    expect(e).toBeDefined();
    expect(e).toStrictEqual(gotErr);
  });
  it('should throw original error of unknown type', async () => {
    const gotErr = {
      statusCode: 418,
      message: 'Sorry, this is a teapot',
    };
    got.mockRejectedValueOnce(gotErr);
    const e = await getError();
    expect(e).toBe(gotErr);
  });
});
