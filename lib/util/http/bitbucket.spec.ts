import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { PLATFORM_TYPE_BITBUCKET } from '../../constants/platforms';
import * as hostRules from '../host-rules';
import { BitbucketHttp, setBaseUrl } from './bitbucket';

const baseUrl = 'https://api.bitbucket.org';

describe(getName(__filename), () => {
  let api: BitbucketHttp;
  beforeEach(() => {
    api = new BitbucketHttp();

    // reset module
    jest.resetAllMocks();

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: PLATFORM_TYPE_BITBUCKET,
      baseUrl,
      token: 'token',
    });

    httpMock.reset();
    httpMock.setup();

    setBaseUrl(baseUrl);
  });
  afterEach(() => {
    httpMock.reset();
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
  it('returns cached', async () => {
    httpMock.scope(baseUrl).get('/projects/foo').reply(200, {});
    const { body } = await api.getJson('projects/foo');
    expect(body).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
});
