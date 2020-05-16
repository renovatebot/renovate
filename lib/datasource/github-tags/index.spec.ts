import * as httpMock from '../../../test/httpMock';
import * as globalCache from '../../util/cache/global';
import * as runCache from '../../util/cache/run';
import * as _hostRules from '../../util/host-rules';
import * as github from '.';

jest.mock('../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';

describe('datasource/github-tags', () => {
  beforeEach(async () => {
    httpMock.setup();
    await globalCache.rmAll();
  });

  afterEach(() => {
    runCache.clear();
    httpMock.reset();
  });

  describe('getDigest', () => {
    const lookupName = 'some/dep';
    const tag = 'v1.2.0';

    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.hosts = jest.fn(() => []);
      hostRules.find.mockReturnValue({
        token: 'some-token',
      });
      return globalCache.rmAll();
    });

    it('returns null if no token', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/commits?per_page=1`)
        .reply(200, []);
      const res = await github.getDigest({ lookupName }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);
      const res = await github.getDigest({ lookupName }, null);
      expect(res).toBe('abcdef');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns commit digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/git/refs/tags/${tag}`)
        .reply(200, { object: { type: 'commit', sha: 'ddd111' } });
      const res = await github.getDigest({ lookupName }, tag);
      expect(res).toBe('ddd111');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns tagged commit digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/git/refs/tags/${tag}`)
        .reply(200, {
          object: { type: 'tag', url: `${githubApiHost}/some-url` },
        })
        .get('/some-url')
        .reply(200, { object: { type: 'commit', sha: 'ddd111' } });
      const res = await github.getDigest({ lookupName }, tag);
      expect(res).toBe('ddd111');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('warns if unknown ref', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/git/refs/tags/${tag}`)
        .reply(200, { object: { sha: 'ddd111' } });
      const res = await github.getDigest({ lookupName }, tag);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for missed tagged digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/git/refs/tags/${tag}`)
        .reply(200, {});
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getReleases', () => {
    const lookupName = 'some/dep2';

    beforeAll(() => globalCache.rmAll());
    it('returns tags', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/tags?per_page=100`)
        .reply(200, body);
      const res = await github.getReleases({ lookupName });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
