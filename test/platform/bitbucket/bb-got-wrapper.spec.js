describe('platform/gl-got-wrapper', () => {
  let api;
  let got;
  let hostRules;
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
      platform: 'bitbucket',
      endpoint: 'https://api.bitbucket.org',
      token: 'token',
    });
  });
  it('posts', async () => {
    const body = ['a', 'b'];
    got.mockImplementationOnce(() => ({
      body,
    }));
    const res = await api.post('some-url');
    expect(res.body).toEqual(body);
  });
  it('returns cached', async () => {
    api.reset();
    got.mockReturnValueOnce({
      body: {},
    });
    const res1 = await api.get('projects/foo');
    const res2 = await api.get('projects/foo');
    expect(res1).toEqual(res2);
  });
});
