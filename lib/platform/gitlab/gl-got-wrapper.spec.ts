import * as httpMock from '../../../test/httpMock';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';
import * as hostRules from '../../util/host-rules';
import { api } from './gl-got-wrapper';

hostRules.add({
  hostType: PLATFORM_TYPE_GITLAB,
  token: 'abc123',
});

const gitlabApiHost = 'https://gitlab.com';

describe('platform/gitlab/gl-got-wrapper', () => {
  const body = ['a', 'b'];
  beforeEach(() => {
    // (delay as any).mockImplementation(() => Promise.resolve());
    httpMock.setup();
  });
  afterEach(() => {
    jest.resetAllMocks();
    httpMock.reset();
  });
  it('paginates', async () => {
    httpMock
      .scope(gitlabApiHost)
      .get('/api/v4/some-url')
      .reply(200, ['a'], {
        link:
          '<https://gitlab.com/api/v4/some-url&page=2>; rel="next", <https://gitlab.com/api/v4/some-url&page=3>; rel="last"',
      })
      .get('/api/v4/some-url&page=2')
      .reply(200, ['b', 'c'], {
        link:
          '<https://gitlab.com/api/v4/some-url&page=3>; rel="next", <https://gitlab.com/api/v4/some-url&page=3>; rel="last"',
      })
      .get('/api/v4/some-url&page=3')
      .reply(200, ['d']);
    const res = await api.get('/some-url', { paginate: true });
    expect(res.body).toHaveLength(4);

    const trace = httpMock.getTrace();
    expect(trace).toHaveLength(3);
    expect(trace).toMatchSnapshot();
  });
  it('attempts to paginate', async () => {
    httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(200, ['a'], {
      link: '<https://gitlab.com/api/v4/some-url&page=3>; rel="last"',
    });
    const res = await api.get('/some-url', { paginate: true });
    expect(res.body).toHaveLength(1);

    const trace = httpMock.getTrace();
    expect(trace).toHaveLength(1);
    expect(trace).toMatchSnapshot();
  });
  it('posts', async () => {
    httpMock.scope(gitlabApiHost).post('/api/v4/some-url').reply(200, body);
    const res = await api.post('/some-url');
    expect(res.body).toEqual(body);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
  it('sets baseUrl', () => {
    expect(() =>
      api.setBaseUrl('https://gitlab.renovatebot.com/api/v4/')
    ).not.toThrow();
  });
});
