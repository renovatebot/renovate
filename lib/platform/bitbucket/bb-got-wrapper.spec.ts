import { GotApi } from '../common';
import { PLATFORM_TYPE_BITBUCKET } from '../../constants/platforms';

describe('platform/gl-got-wrapper', () => {
  let api: GotApi;
  let got: jest.Mock<typeof import('got')>;
  let hostRules: typeof import('../../util/host-rules');
  beforeEach(() => {
    // reset module
    jest.resetAllMocks();
    jest.mock('../../util/got');
    got = require('../../util/got').api;
    hostRules = require('../../util/host-rules');
    api = require('./bb-got-wrapper').api;

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: PLATFORM_TYPE_BITBUCKET,
      baseUrl: 'https://api.bitbucket.org',
      token: 'token',
    });
  });
  it('posts', async () => {
    const body = ['a', 'b'];
    got.mockImplementationOnce(
      () =>
        ({
          body,
        } as any)
    );
    const res = await api.post('some-url');
    expect(res.body).toEqual(body);
  });
  it('accepts custom baseUrl', async () => {
    got.mockImplementation(() => ({} as any));

    await api.post('some-url');
    expect(got.mock.calls[0][1].baseUrl).toBe('https://api.bitbucket.org/');

    const customBaseUrl = 'https://api-test.bitbucket.org';
    api.setBaseUrl(customBaseUrl);
    await api.post('some-url');
    expect(got.mock.calls[1][1].baseUrl).toBe(customBaseUrl);
  });
  it('returns cached', async () => {
    got.mockReturnValueOnce({
      body: {},
    } as any);
    const res1 = await api.get('projects/foo');
    expect(res1).toMatchSnapshot();
  });
});
