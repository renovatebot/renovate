import { GotApi } from '../../../lib/platform/common';
import { HOST_TYPE_BITBUCKET } from '../../../lib/constants/host-types';

describe('platform/gl-got-wrapper', () => {
  let api: GotApi;
  let got: jest.Mock<typeof import('got')>;
  let hostRules: typeof import('../../../lib/util/host-rules');
  beforeEach(() => {
    // reset module
    jest.resetAllMocks();
    jest.mock('../../../lib/util/got');
    got = require('../../../lib/util/got').api;
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket/bb-got-wrapper').api;

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: HOST_TYPE_BITBUCKET,
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
  it('returns cached', async () => {
    got.mockReturnValueOnce({
      body: {},
    } as any);
    const res1 = await api.get('projects/foo');
    expect(res1).toMatchSnapshot();
  });
});
