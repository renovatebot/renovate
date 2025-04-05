import * as hostRules from '../host-rules';
import { range } from '../range';
import { BitbucketServerHttp, setBaseUrl } from './bitbucket-server';
import * as httpMock from '~test/http-mock';

const baseUrl = 'https://git.example.com';

describe('util/http/bitbucket-server', () => {
  let api: BitbucketServerHttp;

  beforeEach(() => {
    api = new BitbucketServerHttp();

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: 'bitbucket-server',
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

  it('invalid path', async () => {
    setBaseUrl('some-in|valid-host');
    const res = api.getJsonUnchecked('/some-url');
    await expect(res).rejects.toThrow('Invalid URL');
  });

  it('pagination: uses default limit if not configured', async () => {
    const valuesPageOne = [...range(1, 100)];
    const valuesPageTwo = [...range(101, 200)];
    const valuesPageThree = [...range(201, 210)];

    httpMock
      .scope(baseUrl)
      .get('/some-url?foo=bar&limit=100')
      .reply(200, {
        values: valuesPageOne,
        size: 100,
        isLastPage: false,
        start: 0,
        limit: 100,
        nextPageStart: 100,
      })
      .get('/some-url?foo=bar&limit=100&start=100')
      .reply(200, {
        values: valuesPageTwo,
        size: 100,
        isLastPage: false,
        start: 100,
        limit: 100,
        nextPageStart: 200,
      })
      .get('/some-url?foo=bar&limit=100&start=200')
      .reply(200, {
        values: valuesPageThree,
        size: 10,
        isLastPage: true,
        start: 200,
        limit: 100,
      });

    const res = await api.getJsonUnchecked('/some-url?foo=bar', {
      paginate: true,
    });
    expect(res.body).toEqual([
      ...valuesPageOne,
      ...valuesPageTwo,
      ...valuesPageThree,
    ]);
  });

  it('pagination: uses configured limit', async () => {
    const valuesPageOne = [...range(1, 50)];
    const valuesPageTwo = [...range(51, 90)];

    httpMock
      .scope(baseUrl)
      .get('/some-url?foo=bar&limit=50')
      .reply(200, {
        values: valuesPageOne,
        size: 50,
        isLastPage: false,
        start: 0,
        limit: 50,
        nextPageStart: 50,
      })
      .get('/some-url?foo=bar&limit=50&start=50')
      .reply(200, {
        values: valuesPageTwo,
        size: 40,
        isLastPage: true,
        start: 50,
        limit: 50,
      });

    const res = await api.getJsonUnchecked('/some-url?foo=bar', {
      paginate: true,
      limit: 50,
    });
    expect(res.body).toEqual([...valuesPageOne, ...valuesPageTwo]);
  });

  it('pagination: fetch only one entry with limit 1 and maxPages 1', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url?foo=bar&limit=1')
      .reply(200, {
        values: [1],
        size: 1,
        isLastPage: false,
        limit: 1,
        start: 0,
        nextPageStart: 1,
      });

    const res = await api.getJsonUnchecked('/some-url?foo=bar', {
      paginate: true,
      limit: 1,
      maxPages: 1,
    });
    expect(res.body).toEqual([1]);
  });
});
