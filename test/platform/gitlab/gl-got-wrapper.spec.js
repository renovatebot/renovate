const got = require('../../../lib/util/got');
const get = require('../../../lib/platform/gitlab/gl-got-wrapper');

describe('platform/gl-got-wrapper', () => {
  const body = ['a', 'b'];
  afterEach(() => {
    jest.resetAllMocks();
  });
  it('paginates', async () => {
    got.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.gitlab.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", <https://api.gitlab.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"',
      },
      body: ['a'],
    });
    got.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.gitlab.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="next", <https://api.gitlab.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"',
      },
      body: ['b', 'c'],
    });
    got.mockReturnValueOnce({
      headers: {},
      body: ['d'],
    });
    const res = await get('some-url', { paginate: true });
    expect(res.body).toHaveLength(4);
    expect(got).toHaveBeenCalledTimes(3);
  });
  it('attempts to paginate', async () => {
    got.mockReturnValueOnce({
      headers: {
        link:
          '<https://api.gitlab.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"',
      },
      body: ['a'],
    });
    got.mockReturnValueOnce({
      headers: {},
      body: ['b'],
    });
    const res = await get('some-url', { paginate: true });
    expect(res.body).toHaveLength(1);
    expect(got).toHaveBeenCalledTimes(1);
  });
  it('posts', async () => {
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
  it('sets endpoint', () => {
    get.setEndpoint('https://gitlab.renovatebot.com/api/v4/');
  });
});
