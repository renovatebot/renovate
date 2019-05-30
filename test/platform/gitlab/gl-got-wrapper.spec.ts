import got from '../../../lib/util/got';
import api from '../../../lib/platform/gitlab/gl-got-wrapper';
import * as hostRules from '../../../lib/util/host-rules';

jest.mock('../../../lib/util/got');

hostRules.add({
  hostType: 'gitlab',
  token: 'abc123',
});

describe('platform/gitlab/gl-got-wrapper', () => {
  const body = ['a', 'b'];
  afterEach(() => {
    jest.resetAllMocks();
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
    const res = await api.get('some-url', { paginate: true });
    expect(res.body).toHaveLength(1);
    expect(got).toHaveBeenCalledTimes(1);
  });
  it('posts', async () => {
    got.mockImplementationOnce(() => ({
      body,
    }));
    const res = await api.post('some-url');
    expect(res.body).toEqual(body);
  });
  it('sets baseUrl', () => {
    api.setBaseUrl('https://gitlab.renovatebot.com/api/v4/');
  });
});
