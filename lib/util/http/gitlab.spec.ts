import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';
import * as hostRules from '../host-rules';
import { GitlabHttp, setBaseUrl } from './gitlab';

hostRules.add({
  hostType: PLATFORM_TYPE_GITLAB,
  token: 'abc123',
});

const gitlabApiHost = 'https://gitlab.com';

describe(getName(__filename), () => {
  let gitlabApi: GitlabHttp;

  beforeEach(() => {
    gitlabApi = new GitlabHttp();
    setBaseUrl(`${gitlabApiHost}/api/v4/`);
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
    const res = await gitlabApi.getJson('some-url', { paginate: true });
    expect(res.body).toHaveLength(4);

    const trace = httpMock.getTrace();
    expect(trace).toHaveLength(3);
    expect(trace).toMatchSnapshot();
  });
  it('attempts to paginate', async () => {
    httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(200, ['a'], {
      link: '<https://gitlab.com/api/v4/some-url&page=3>; rel="last"',
    });
    const res = await gitlabApi.getJson('some-url', { paginate: true });
    expect(res.body).toHaveLength(1);

    const trace = httpMock.getTrace();
    expect(trace).toHaveLength(1);
    expect(trace).toMatchSnapshot();
  });
  it('posts', async () => {
    const body = ['a', 'b'];
    httpMock.scope(gitlabApiHost).post('/api/v4/some-url').reply(200, body);
    const res = await gitlabApi.postJson('some-url');
    expect(res.body).toEqual(body);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
  it('sets baseUrl', () => {
    expect(() =>
      setBaseUrl('https://gitlab.renovatebot.com/api/v4/')
    ).not.toThrow();
  });

  describe('fails with', () => {
    it('403', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(403);
      await expect(
        gitlabApi.get('some-url')
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Response code 403 (Forbidden)"`
      );
    });

    it('404', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(404);
      await expect(
        gitlabApi.get('some-url')
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Response code 404 (Not Found)"`
      );
    });

    it('500', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(500);
      await expect(gitlabApi.get('some-url')).rejects.toThrow(
        EXTERNAL_HOST_ERROR
      );
    });

    it('EAI_AGAIN', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/some-url')
        .replyWithError({ code: 'EAI_AGAIN' });
      await expect(gitlabApi.get('some-url')).rejects.toThrow(
        EXTERNAL_HOST_ERROR
      );
    });

    it('ParseError', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(200, '{{');
      await expect(gitlabApi.getJson('some-url')).rejects.toThrow(
        EXTERNAL_HOST_ERROR
      );
    });
  });
});
