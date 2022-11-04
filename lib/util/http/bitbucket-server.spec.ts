import * as httpMock from '../../../test/http-mock';
import * as hostRules from '../host-rules';
import { BitbucketServerHttp, setBaseUrl } from './bitbucket-server';

const baseUrl = 'https://git.example.com';

describe('util/http/bitbucket-server', () => {
  let api: BitbucketServerHttp;

  beforeEach(() => {
    api = new BitbucketServerHttp();

    // reset module
    jest.resetAllMocks();

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
});
