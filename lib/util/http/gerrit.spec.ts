import * as httpMock from '../../../test/http-mock';
import { GerritHttp, setBaseUrl } from './gerrit';

const baseUrl = 'https://gerrit.example.com/';

describe('util/http/gerrit', () => {
  let api: GerritHttp;

  beforeEach(() => {
    api = new GerritHttp();
    setBaseUrl(baseUrl);
    // reset module
    jest.resetAllMocks();
  });

  it('get', async () => {
    const body = 'body result';
    httpMock.scope(baseUrl).get('/some-url').reply(200, gerritResult(body));

    const res = await api.get('some-url');
    expect(res.body).toEqual(body);
  });

  it('getJson', () => {
    const body = { key: 'value' };
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .matchHeader('a', 'b')
      .reply(200, gerritResult(JSON.stringify(body)));

    return expect(
      api.getJson('some-url', { headers: { a: 'b' } }).then((res) => res.body)
    ).resolves.toEqual(body);
  });

  it('postJson', () => {
    httpMock
      .scope(baseUrl)
      .post('/some-url')
      .matchHeader('content-Type', 'application/json')
      .reply(200, gerritResult('{"res":"success"}'));

    return expect(
      api
        .postJson('some-url', { body: { key: 'value' } })
        .then((res) => res.body)
    ).resolves.toEqual({ res: 'success' });
  });

  it('putJson', () => {
    httpMock
      .scope(baseUrl)
      .put('/some-url')
      .matchHeader('content-Type', 'application/json')
      .reply(200, gerritResult('{"res":"success"}'));

    return expect(
      api.putJson('some-url', { body: { key: 'value' } }).then((r) => r.body)
    ).resolves.toEqual({ res: 'success' });
  });
});

function gerritResult(body: string): string {
  return `)]}'\n${body}`;
}
