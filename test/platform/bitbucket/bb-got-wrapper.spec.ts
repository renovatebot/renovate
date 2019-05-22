import { IGotApi } from '../../../lib/platform/common';

describe('platform/gl-got-wrapper', () => {
  let api: IGotApi;
  let got: jest.Mock<typeof import('got')>;
  let hostRules: typeof import('../../../lib/util/host-rules');
  beforeEach(() => {
    // reset module
    jest.resetAllMocks();
    jest.mock('got');
    got = require('got');
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket/bb-got-wrapper').api;

    // clean up hostRules
    hostRules.clear();
    hostRules.update({
      hostType: 'bitbucket',
      endpoint: 'https://api.bitbucket.org',
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
    api.reset();
    got.mockReturnValueOnce({
      body: {},
    } as any);
    const res1 = await api.get('projects/foo');
    const res2 = await api.get('projects/foo');
    expect(res1).toEqual(res2);
  });
});
