import * as httpMock from '../../../test/http-mock';
import { PlatformId } from '../../constants';
import * as hostRules from '../host-rules';
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
      hostType: PlatformId.Bitbucket,
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
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
  it('accepts custom baseUrl', async () => {
    const customBaseUrl = 'https://api-test.bitbucket.org';
    httpMock.scope(baseUrl).post('/some-url').reply(200, {});
    httpMock.scope(customBaseUrl).post('/some-url').reply(200, {});

    await api.postJson('some-url');

    setBaseUrl(customBaseUrl);
    await api.postJson('some-url');

    expect(httpMock.getTrace()).toMatchSnapshot();
  });
});
