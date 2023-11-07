import * as httpMock from '../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { GitlabReleasesDatasource } from '../../modules/datasource/gitlab-releases';
import * as hostRules from '../host-rules';
import { GitlabHttp, setBaseUrl } from './gitlab';

hostRules.add({
  hostType: 'gitlab',
  token: '123test',
});

const gitlabApiHost = 'https://gitlab.com';
const selfHostedUrl = 'http://mycompany.com/gitlab';

describe('util/http/gitlab', () => {
  let gitlabApi: GitlabHttp;

  beforeEach(() => {
    gitlabApi = new GitlabHttp();
    setBaseUrl(`${gitlabApiHost}/api/v4/`);
    delete process.env.GITLAB_IGNORE_REPO_URL;

    hostRules.add({
      hostType: 'gitlab',
      token: 'abc123',
    });
  });

  afterEach(() => {
    hostRules.clear();
  });

  it('paginates', async () => {
    httpMock
      .scope(gitlabApiHost)
      .get('/api/v4/some-url')
      .reply(200, ['a'], {
        link: '<https://gitlab.com/api/v4/some-url&page=2>; rel="next", <https://gitlab.com/api/v4/some-url&page=3>; rel="last"',
      })
      .get('/api/v4/some-url&page=2')
      .reply(200, ['b', 'c'], {
        link: '<https://gitlab.com/api/v4/some-url&page=3>; rel="next", <https://gitlab.com/api/v4/some-url&page=3>; rel="last"',
      })
      .get('/api/v4/some-url&page=3')
      .reply(200, ['d']);
    const res = await gitlabApi.getJson('some-url', { paginate: true });
    expect(res.body).toHaveLength(4);
  });

  it('paginates with GITLAB_IGNORE_REPO_URL set', async () => {
    process.env.GITLAB_IGNORE_REPO_URL = 'true';
    setBaseUrl(`${selfHostedUrl}/api/v4/`);

    httpMock
      .scope(selfHostedUrl)
      .get('/api/v4/some-url')
      .reply(200, ['a'], {
        link: '<https://other.host.com/gitlab/api/v4/some-url&page=2>; rel="next", <https://other.host.com/gitlab/api/v4/some-url&page=3>; rel="last"',
      })
      .get('/api/v4/some-url&page=2')
      .reply(200, ['b', 'c'], {
        link: '<https://other.host.com/gitlab/api/v4/some-url&page=3>; rel="next", <https://other.host.com/gitlab/api/v4/some-url&page=3>; rel="last"',
      })
      .get('/api/v4/some-url&page=3')
      .reply(200, ['d']);
    const res = await gitlabApi.getJson('some-url', { paginate: true });
    expect(res.body).toHaveLength(4);
  });

  it('supports different datasources', async () => {
    const gitlabApiDatasource = new GitlabHttp(GitlabReleasesDatasource.id);
    hostRules.add({ hostType: 'gitlab', token: 'abc' });
    hostRules.add({
      hostType: GitlabReleasesDatasource.id,
      token: 'def',
    });
    httpMock
      .scope(gitlabApiHost, { reqheaders: { authorization: 'Bearer def' } })
      .get('/api/v4/some-url')
      .reply(200);
    const response = await gitlabApiDatasource.get('/some-url');
    expect(response).not.toBeNull();
  });

  it('attempts to paginate', async () => {
    httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(200, ['a'], {
      link: '<https://gitlab.com/api/v4/some-url&page=3>; rel="last"',
    });
    const res = await gitlabApi.getJson('some-url', { paginate: true });
    expect(res.body).toHaveLength(1);
  });

  it('posts', async () => {
    const body = ['a', 'b'];
    httpMock.scope(gitlabApiHost).post('/api/v4/some-url').reply(200, body);
    const res = await gitlabApi.postJson('some-url');
    expect(res.body).toEqual(body);
  });

  it('sets baseUrl', () => {
    expect(() => setBaseUrl(`${selfHostedUrl}/api/v4/`)).not.toThrow();
  });

  describe('fails with', () => {
    it('403', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(403);
      await expect(
        gitlabApi.get('some-url'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Response code 403 (Forbidden)"`,
      );
    });

    it('404', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(404);
      await expect(
        gitlabApi.get('some-url'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Response code 404 (Not Found)"`,
      );
    });

    it('500', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(500);
      await expect(gitlabApi.get('some-url')).rejects.toThrow(
        EXTERNAL_HOST_ERROR,
      );
    });

    it('EAI_AGAIN', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/some-url')
        .replyWithError({ code: 'EAI_AGAIN' });
      await expect(gitlabApi.get('some-url')).rejects.toThrow(
        EXTERNAL_HOST_ERROR,
      );
    });

    it('ParseError', async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/some-url').reply(200, '{{');
      await expect(gitlabApi.getJson('some-url')).rejects.toThrow(
        EXTERNAL_HOST_ERROR,
      );
    });
  });
});
