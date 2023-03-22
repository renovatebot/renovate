import * as httpMock from '../../../test/http-mock';
import * as hostRules from '../host-rules';
import { JiraHttp, setBaseUrl } from './jira';

const baseUrl = 'https://api.atlassian.com';

describe('util/http/jira', () => {
  let api: JiraHttp;

  beforeEach(() => {
    api = new JiraHttp();

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: 'jira',
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
    const customBaseUrl = 'https://api-test.atlassian.com';
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
});
