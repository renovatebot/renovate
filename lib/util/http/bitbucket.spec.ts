import * as httpMock from '../../../test/http-mock';
import * as hostRules from '../host-rules';
import { range } from '../range';
import { BitbucketHttp, setBaseUrl } from './bitbucket';

const baseUrl = 'https://api.bitbucket.org';

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
    const res = await api.getJson('/some-url?foo=bar', { paginate: true });
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
    const res = await api.getJson('some-url?pagelen=10', { paginate: true });
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
    const res = await api.getJson('some-url', {
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
