import * as httpMock from '../../../test/http-mock';
import * as hostRules from '../host-rules';
import { JiraHttp, setBaseUrl } from './jira';

describe('util/http/jira', () => {
  const api = new JiraHttp();

  it('throws error if setBaseUrl not called', async () => {
    await expect(api.postJson('some-path')).rejects.toThrow(
      new TypeError('Invalid URL')
    );
  });

  it('accepts custom baseUrl', async () => {
    const siteUrl = 'https://some-site.atlassian.com';
    httpMock.scope(siteUrl).post('/some-path').reply(200, {});
    hostRules.add({
      hostType: 'jira',
      matchHost: siteUrl,
      token: 'token',
    });
    setBaseUrl(siteUrl);

    expect(await api.postJson('some-path')).toEqual({
      authorization: true,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
  });
});
