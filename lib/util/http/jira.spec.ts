import * as httpMock from '../../../test/http-mock';
import { JiraHttp, setBaseUrl } from './jira';

describe('util/http/jira', () => {
  const api = new JiraHttp();

  it('throws error if setBaseUrl not called', async () => {
    await expect(api.postJson('some-path')).rejects.toThrow(
      new TypeError('Invalid URL'),
    );
  });

  it('accepts custom baseUrl', async () => {
    const siteUrl = 'https://some-site.atlassian.com';
    httpMock.scope(siteUrl).post('/some-path').reply(200, {});
    setBaseUrl(siteUrl);

    expect(await api.postJson('some-path')).toEqual({
      authorization: false,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
  });
});
