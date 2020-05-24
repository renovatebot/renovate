import * as httpMock from '../../../test/httpMock';
import { PLATFORM_TYPE_BITBUCKET } from '../../constants/platforms';
import * as hostRules from '../../util/host-rules';
import { api } from './bb-got-wrapper';

const baseUrl = 'https://api.bitbucket.org';

describe('platform/gl-got-wrapper', () => {
  beforeEach(() => {
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

    api.setBaseUrl(baseUrl);
  });
  it('posts', async () => {
    const body = ['a', 'b'];
    httpMock.scope(baseUrl).post('/some-url').reply(200, body);
    const res = await api.post('some-url');
    expect(res.body).toEqual(body);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
  it('accepts custom baseUrl', async () => {
    const customBaseUrl = 'https://api-test.bitbucket.org';
    httpMock.scope(baseUrl).post('/some-url').reply(200, {});
    httpMock.scope(customBaseUrl).post('/some-url').reply(200, {});

    await api.post('some-url');

    api.setBaseUrl(customBaseUrl);
    await api.post('some-url');

    expect(httpMock.getTrace()).toMatchSnapshot();
  });
  it('returns cached', async () => {
    httpMock.scope(baseUrl).get('/projects/foo').reply(200, {});
    const { body } = await api.get('projects/foo');
    expect(body).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
});
