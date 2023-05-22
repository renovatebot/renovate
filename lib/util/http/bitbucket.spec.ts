import * as httpMock from '../../../test/http-mock';
import * as hostRules from '../host-rules';
import { BitbucketHttp, setBaseUrl } from './bitbucket';

const baseUrl = 'https://api.bitbucket.org';
const range = (count: number) => [...Array(count).keys()];

describe('util/http/bitbucket', () => {
  let api: BitbucketHttp;

  beforeEach(() => {
    api = new BitbucketHttp();

    // reset module
    jest.resetAllMocks();

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

  it('paginates: adds default pagelen if non is present', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url?foo=bar&pagelen=100')
      .reply(200, {
        values: range(100),
        page: '1',
        next: `${baseUrl}/some-url?foo=bar&pagelen=100&page=2`,
      })
      .get('/some-url?foo=bar&pagelen=100&page=2')
      .reply(200, {
        values: range(100),
        page: '2',
        next: `${baseUrl}/some-url?foo=bar&pagelen=100&page=3`,
      })
      .get('/some-url?foo=bar&pagelen=100&page=3')
      .reply(200, {
        values: range(10),
        page: '3',
      });
    const res = await api.getJson('/some-url?foo=bar', { paginate: true });
    expect(res.body).toEqual({
      page: '1',
      pagelen: 210,
      size: 210,
      values: expect.arrayContaining(Array(210)),
      next: undefined,
    });
  });

  it('paginates: respects pagelen if already set in path', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url?pagelen=10')
      .reply(200, {
        values: range(10),
        page: '1',
        next: `${baseUrl}/some-url?pagelen=10&page=2`,
      })
      .get('/some-url?pagelen=10&page=2')
      .reply(200, {
        values: range(10),
        page: '2',
        next: `${baseUrl}/some-url?pagelen=10&page=3`,
      })
      .get('/some-url?pagelen=10&page=3')
      .reply(200, {
        values: range(1),
        page: '3',
      });
    const res = await api.getJson('some-url?pagelen=10', { paginate: true });
    expect(res.body).toEqual({
      page: '1',
      pagelen: 21,
      size: 21,
      values: expect.arrayContaining(Array(21)),
      next: undefined,
    });
  });

  it('paginates: respects pagelen if set in options', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url?pagelen=20')
      .reply(200, {
        values: range(20),
        page: '1',
        next: `${baseUrl}/some-url?pagelen=20&page=2`,
      })
      .get('/some-url?pagelen=20&page=2')
      .reply(200, {
        values: range(20),
        page: '2',
        next: `${baseUrl}/some-url?pagelen=20&page=3`,
      })
      .get('/some-url?pagelen=20&page=3')
      .reply(200, {
        values: range(4),
        page: '3',
      });
    const res = await api.getJson('some-url', {
      paginate: true,
      pagelen: 20,
    });
    expect(res.body).toEqual({
      page: '1',
      pagelen: 44,
      size: 44,
      values: expect.arrayContaining(Array(44)),
      next: undefined,
    });
  });
});
