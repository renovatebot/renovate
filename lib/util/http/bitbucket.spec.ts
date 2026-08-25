import * as httpMock from '~test/http-mock.ts';
import { logger } from '~test/util.ts';
import * as hostRules from '../host-rules.ts';
import { range } from '../range.ts';
import { BitbucketHttp, setBaseUrl } from './bitbucket.ts';

const baseUrl = 'https://api.bitbucket.org';

describe('util/http/bitbucket', () => {
  let api: BitbucketHttp;

  beforeEach(() => {
    api = new BitbucketHttp();

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: 'bitbucket',
      matchHost: baseUrl,
      token: 'token',
    });

    setBaseUrl(baseUrl);
  });

  it('posts', async () => {
    const body = ['a', 'b'];
    httpMock.scope(baseUrl).post('/some-url').reply(200, body);
    const res = await api.postJson('some-url');
    expect(res.body).toEqual(body);
  });

  it('accepts custom baseUrl', async () => {
    const customBaseUrl = 'https://api-test.bitbucket.org';
    httpMock.scope(baseUrl).post('/some-url').reply(200, {});
    httpMock.scope(customBaseUrl).post('/some-url').reply(200, {});

    expect(await api.postJson('some-url')).toEqual({
      authorization: true,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });

    setBaseUrl(customBaseUrl);
    expect(await api.postJson('some-url')).toEqual({
      authorization: false,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
  });

  it('warns when an endpoint announces a deprecation', async () => {
    httpMock.scope(baseUrl).get('/some-url').reply(
      200,
      {},
      {
        deprecation: '@1771545600',
        sunset: 'Fri, 21 Aug 2026 00:00:00 UTC',
        link: '<https://developer.atlassian.com/cloud/bitbucket/changelog#CHANGE-3071>; rel="deprecation"; type="text/html"',
      },
    );

    await api.getJsonUnchecked('some-url');

    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      {
        url: `${baseUrl}/some-url`,
        deprecation: '2026-02-20T00:00:00.000Z',
        sunset: '2026-08-21T00:00:00.000Z',
        announcementUrl:
          'https://developer.atlassian.com/cloud/bitbucket/changelog#CHANGE-3071',
      },
      'Bitbucket API endpoint has been marked as deprecated',
    );
  });

  it('warns when only a sunset is announced', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .reply(200, {}, { sunset: 'Fri, 21 Aug 2026 00:00:00 UTC' });

    await api.getJsonUnchecked('some-url');

    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      {
        url: `${baseUrl}/some-url`,
        deprecation: undefined,
        sunset: '2026-08-21T00:00:00.000Z',
        announcementUrl: undefined,
      },
      'Bitbucket API endpoint has been marked as deprecated',
    );
  });

  it('formats HTTP dates which are already spec compliant', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .reply(200, {}, { deprecation: 'Sun, 11 Nov 2018 23:59:59 GMT' });

    await api.getJsonUnchecked('some-url');

    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      expect.objectContaining({ deprecation: '2018-11-11T23:59:59.000Z' }),
      'Bitbucket API endpoint has been marked as deprecated',
    );
  });

  it('passes through values it cannot format', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .reply(200, {}, { deprecation: '@99999999999999999999' })
      .get('/other-url')
      .reply(200, {}, { sunset: 'not a date' });

    await api.getJsonUnchecked('some-url');
    await api.getJsonUnchecked('other-url');

    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      expect.objectContaining({ deprecation: '@99999999999999999999' }),
      'Bitbucket API endpoint has been marked as deprecated',
    );
    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sunset: 'not a date' }),
      'Bitbucket API endpoint has been marked as deprecated',
    );
  });

  it('does not warn when no deprecation is announced', async () => {
    httpMock.scope(baseUrl).get('/some-url').reply(200, {});

    await api.getJsonUnchecked('some-url');

    expect(logger.logger.once.warn).not.toHaveBeenCalled();
  });

  it('warns about deprecated functionality', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .reply(410, {
        type: 'error',
        error: {
          message: 'CHANGE-3071 - Functionality has been deprecated',
          detail: 'Please read the changelog entry for more details.',
          data: {
            announcement_url:
              'https://developer.atlassian.com/cloud/bitbucket/changelog#CHANGE-3071',
          },
        },
      });

    await expect(api.getJsonUnchecked('some-url')).rejects.toThrow(
      'Request failed with status code 410 (Gone)',
    );

    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      {
        url: `${baseUrl}/some-url`,
        message: 'CHANGE-3071 - Functionality has been deprecated',
        detail: 'Please read the changelog entry for more details.',
        announcementUrl:
          'https://developer.atlassian.com/cloud/bitbucket/changelog#CHANGE-3071',
      },
      'Bitbucket API functionality has been deprecated or removed',
    );
  });

  it('warns about deprecated functionality for non-JSON responses', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .reply(
        410,
        JSON.stringify({
          error: {
            message: 'CHANGE-3071 - Functionality has been deprecated',
            data: {
              announcement_url:
                'https://developer.atlassian.com/cloud/bitbucket/changelog#CHANGE-3071',
            },
          },
        }),
      );

    await expect(api.get('some-url')).rejects.toThrow(
      'Request failed with status code 410 (Gone)',
    );

    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      {
        url: `${baseUrl}/some-url`,
        message: 'CHANGE-3071 - Functionality has been deprecated',
        detail: undefined,
        announcementUrl:
          'https://developer.atlassian.com/cloud/bitbucket/changelog#CHANGE-3071',
      },
      'Bitbucket API functionality has been deprecated or removed',
    );
  });

  it('does not warn when the request failed without a response', async () => {
    httpMock.scope(baseUrl).get('/some-url').replyWithError('some error');

    await expect(api.getJsonUnchecked('some-url')).rejects.toThrow(
      'some error',
    );

    expect(logger.logger.once.warn).not.toHaveBeenCalled();
  });

  it('does not warn for unrelated errors', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .reply(404, { type: 'error', error: { message: 'Not found' } });

    await expect(api.getJsonUnchecked('some-url')).rejects.toThrow(
      'Request failed with status code 404 (Not Found)',
    );

    expect(logger.logger.once.warn).not.toHaveBeenCalled();
  });

  it('paginates: adds default pagelen if non is present', async () => {
    const valuesPageOne = [...range(1, 100)];
    const valuesPageTwo = [...range(101, 200)];
    const valuesPageThree = [...range(201, 210)];

    httpMock
      .scope(baseUrl)
      .get('/some-url?foo=bar&pagelen=100')
      .reply(200, {
        values: valuesPageOne,
        page: '1',
        next: `${baseUrl}/some-url?foo=bar&pagelen=100&page=2`,
      })
      .get('/some-url?foo=bar&pagelen=100&page=2')
      .reply(200, {
        values: valuesPageTwo,
        page: '2',
        next: `${baseUrl}/some-url?foo=bar&pagelen=100&page=3`,
      })
      .get('/some-url?foo=bar&pagelen=100&page=3')
      .reply(200, {
        values: valuesPageThree,
        page: '3',
      });
    const res = await api.getJsonUnchecked('/some-url?foo=bar', {
      paginate: true,
    });
    expect(res.body).toEqual({
      page: '1',
      pagelen: 210,
      size: 210,
      values: [...valuesPageOne, ...valuesPageTwo, ...valuesPageThree],
      next: undefined,
    });
  });

  it('paginates: respects pagelen if already set in path', async () => {
    const valuesPageOne = [...range(1, 10)];
    const valuesPageTwo = [...range(11, 20)];
    const valuesPageThree = [...range(21, 21)];

    httpMock
      .scope(baseUrl)
      .get('/some-url?pagelen=10')
      .reply(200, {
        values: valuesPageOne,
        page: '1',
        next: `${baseUrl}/some-url?pagelen=10&page=2`,
      })
      .get('/some-url?pagelen=10&page=2')
      .reply(200, {
        values: valuesPageTwo,
        page: '2',
        next: `${baseUrl}/some-url?pagelen=10&page=3`,
      })
      .get('/some-url?pagelen=10&page=3')
      .reply(200, {
        values: valuesPageThree,
        page: '3',
      });
    const res = await api.getJsonUnchecked('some-url?pagelen=10', {
      paginate: true,
    });
    expect(res.body).toEqual({
      page: '1',
      pagelen: 21,
      size: 21,
      values: [...valuesPageOne, ...valuesPageTwo, ...valuesPageThree],
      next: undefined,
    });
  });

  it('paginates: respects pagelen if set in options', async () => {
    const valuesPageOne = [...range(1, 20)];
    const valuesPageTwo = [...range(21, 40)];
    const valuesPageThree = [...range(41, 44)];

    httpMock
      .scope(baseUrl)
      .get('/some-url?pagelen=20')
      .reply(200, {
        values: valuesPageOne,
        page: '1',
        next: `${baseUrl}/some-url?pagelen=20&page=2`,
      })
      .get('/some-url?pagelen=20&page=2')
      .reply(200, {
        values: valuesPageTwo,
        page: '2',
        next: `${baseUrl}/some-url?pagelen=20&page=3`,
      })
      .get('/some-url?pagelen=20&page=3')
      .reply(200, {
        values: valuesPageThree,
        page: '3',
      });
    const res = await api.getJsonUnchecked('some-url', {
      paginate: true,
      pagelen: 20,
    });
    expect(res.body).toEqual({
      page: '1',
      pagelen: 44,
      size: 44,
      values: [...valuesPageOne, ...valuesPageTwo, ...valuesPageThree],
      next: undefined,
    });
  });
});
