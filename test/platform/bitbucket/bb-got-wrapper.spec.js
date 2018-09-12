describe('platform/gl-got-wrapper', () => {
  let get;
  let got;
  let endpoints;
  beforeEach(() => {
    // reset module
    jest.resetAllMocks();
    jest.mock('got');
    got = require('got');
    endpoints = require('../../../lib/util/host-rules');
    get = require('../../../lib/platform/bitbucket/bb-got-wrapper');

    // clean up endpoints
    endpoints.clear();
    endpoints.update({
      platform: 'bitbucket',
      token: 'token',
    });
  });
  it('posts', async () => {
    const body = ['a', 'b'];
    got.mockImplementationOnce(() => ({
      body,
    }));
    const res = await get.post('some-url');
    expect(res.body).toEqual(body);
  });
  it('returns cached', async () => {
    get.reset();
    got.mockReturnValueOnce({
      body: {},
    });
    const res1 = await get('projects/foo');
    const res2 = await get('projects/foo');
    expect(res1).toEqual(res2);
  });
});
