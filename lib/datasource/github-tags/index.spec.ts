import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as github from '.';

jest.mock('../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';
const githubEnterpriseApiHost = 'https://git.enterprise.com';

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.reset();
    httpMock.setup();
    jest.resetAllMocks();
    hostRules.hosts = jest.fn(() => []);
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
  });
  afterEach(() => {
    httpMock.reset();
  });

  describe('getDigest', () => {
    const lookupName = 'some/dep';
    const tag = 'v1.2.0';

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

    it('supports ghe', async () => {
      httpMock
        .scope(githubEnterpriseApiHost)
        .get(`/api/v3/repos/${lookupName}/git/refs/tags/${tag}`)
        .reply(200, { object: { type: 'commit', sha: 'ddd111' } })
        .get(`/api/v3/repos/${lookupName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);

      const sha1 = await github.getDigest(
        { lookupName, registryUrl: githubEnterpriseApiHost },
        null
      );
      const sha2 = await github.getDigest(
        { lookupName: 'some/dep', registryUrl: githubEnterpriseApiHost },
        'v1.2.0'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(sha1).toBe('abcdef');
      expect(sha2).toBe('ddd111');
    });
  });
  describe('getReleases', () => {
    beforeEach(() => {
      httpMock.reset();
      httpMock.setup();
      jest.resetAllMocks();
      hostRules.hosts = jest.fn(() => []);
      hostRules.find.mockReturnValue({
        token: 'some-token',
      });
    });
    afterEach(() => {
      httpMock.reset();
    });

    const depName = 'some/dep2';

    it('returns tags', async () => {
      const tags = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      const releases = tags.map((item, idx) => ({
        tag_name: item.name,
        published_at: new Date(idx),
        prerelease: !!idx,
      }));
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${depName}/tags?per_page=100`)
        .reply(200, tags)
        .get(`/repos/${depName}/releases?per_page=100`)
        .reply(200, releases);
      const res = await getPkgReleases({ datasource: github.id, depName });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('supports ghe', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      httpMock
        .scope(githubEnterpriseApiHost)
        .get(`/api/v3/repos/${depName}/tags?per_page=100`)
        .reply(200, body)
        .get(`/api/v3/repos/${depName}/releases?per_page=100`)
        .reply(404);

      const res = await github.getReleases({
        registryUrl: 'https://git.enterprise.com',
        lookupName: depName,
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
