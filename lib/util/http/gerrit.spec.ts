import * as httpMock from '../../../test/http-mock';
import { GerritHttp, setBaseUrl } from './gerrit';

const baseUrl = 'https://gerrit.example.com/';

describe('util/http/gerrit', () => {
  let api: GerritHttp;

  beforeEach(() => {
    api = new GerritHttp();
    setBaseUrl(baseUrl);
  });

  it.each(['some-url/', baseUrl + 'some-url/'])('get %p', async (pathOrUrl) => {
    const body = 'body result';
    httpMock
      .scope(baseUrl)
      .get(/some-url\/$/)
      .reply(200, body, { 'content-type': 'text/plain;charset=utf-8' });

    const res = await api.get(pathOrUrl);
    expect(res.body).toEqual(body);
  });

  it('getJson', async () => {
    const body = { key: 'value' };
    httpMock
      .scope(baseUrl)
      .get('/some-url')
      .matchHeader('a', 'b')
      .reply(200, gerritResult(JSON.stringify(body)), {
        'content-type': 'application/json;charset=utf-8',
      });

    const res = await api
      .getJson('some-url', { headers: { a: 'b' } })
      .then((res) => res.body);
    return expect(res).toEqual(body);
  });

  it('postJson', () => {
    httpMock
      .scope(baseUrl)
      .post('/some-url')
      .matchHeader('content-Type', 'application/json')
      .reply(200, gerritResult('{"res":"success"}'), {
        'content-type': 'application/json;charset=utf-8',
      });

    return expect(
      api
        .postJson('some-url', { body: { key: 'value' } })
        .then((res) => res.body),
    ).resolves.toEqual({ res: 'success' });
  });

  it('putJson', () => {
    httpMock
      .scope(baseUrl)
      .put('/some-url')
      .matchHeader('content-Type', 'application/json')
      .reply(200, gerritResult('{"res":"success"}'), {
        'content-type': 'application/json;charset=utf-8',
      });

    return expect(
      api.putJson('some-url', { body: { key: 'value' } }).then((r) => r.body),
    ).resolves.toEqual({ res: 'success' });
  });
});

function gerritResult(body: string): string {
  return `)]}'\n${body}`;
}
