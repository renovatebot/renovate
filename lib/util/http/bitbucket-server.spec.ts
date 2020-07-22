import * as httpMock from '../../../test/httpMock';
import { getName } from '../../../test/util';
import { PLATFORM_TYPE_BITBUCKET_SERVER } from '../../constants/platforms';
import * as hostRules from '../host-rules';
import { BitbucketServerHttp, setBaseUrl } from './bitbucket-server';

const baseUrl = 'https://git.example.com';

describe(getName(__filename), () => {
  let api: BitbucketServerHttp;
  beforeEach(() => {
    api = new BitbucketServerHttp();

    // reset module
    jest.resetAllMocks();

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: PLATFORM_TYPE_BITBUCKET_SERVER,
      baseUrl,
      token: 'token',
    });

    httpMock.reset();
    httpMock.setup();

    setBaseUrl(baseUrl);
  });
  it('posts', async () => {
    const body = ['a', 'b'];
    httpMock.scope(baseUrl).post('/some-url').reply(200, body);
    const res = await api.postJson('some-url');
    expect(res.body).toEqual(body);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
});
