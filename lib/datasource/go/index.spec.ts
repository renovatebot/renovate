import * as httpMock from '../../../test/http-mock';
import { loadFixture, mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { GoDatasource } from '.';

jest.mock('../../util/host-rules');
const hostRules = mocked(_hostRules);

const getReleasesDirectMock = jest.fn();

const getDigestGithubMock = jest.fn();
const getDigestGitlabMock = jest.fn();
const getDigestBitbucketMock = jest.fn();
jest.mock('./releases-direct', () => {
  return {
    GoDirectDatasource: jest.fn().mockImplementation(() => {
      return {
        github: { getDigest: () => getDigestGithubMock() },
        gitlab: { getDigest: () => getDigestGitlabMock() },
        bitbucket: { getDigest: () => getDigestBitbucketMock() },
        getReleases: () => getReleasesDirectMock(),
      };
    }),
  };
});

const getReleasesProxyMock = jest.fn();
jest.mock('./releases-goproxy', () => {
  return {
    GoProxyDatasource: jest.fn().mockImplementation(() => {
      return {
        getReleases: () => getReleasesProxyMock(),
      };
    }),
  };
});

const datasource = new GoDatasource();

describe('datasource/go/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    afterEach(() => {
      jest.resetAllMocks();
      delete process.env.GOPROXY;
    });

    it('fetches release info directly from VCS', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      getReleasesProxyMock.mockResolvedValue(null);
      getReleasesDirectMock.mockResolvedValue(expected);

      const res = await datasource.getReleases({
        lookupName: 'golang.org/foo/bar',
      });

      expect(res).toBe(expected);
      expect(getReleasesProxyMock).not.toHaveBeenCalled();
      expect(getReleasesDirectMock).toHaveBeenCalled();
    });

    it('supports GOPROXY', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      getReleasesProxyMock.mockResolvedValue(expected);
      getReleasesDirectMock.mockResolvedValue(null);
      process.env.GOPROXY = 'https://proxy.golang.org,direct';

      const res = await datasource.getReleases({
        lookupName: 'golang.org/foo/bar',
      });

      expect(res).toBe(expected);
      expect(getReleasesProxyMock).toHaveBeenCalled();
      expect(getReleasesDirectMock).not.toHaveBeenCalled();
    });
  });

  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('returns null for no go-source tag', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, '');
      const res = await datasource.getDigest(
        { lookupName: 'golang.org/y/text' },
        null
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for wrong name', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, loadFixture('go-get-github.html'));
      const res = await datasource.getDigest(
        { lookupName: 'golang.org/y/text' },
        null
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports gitlab digest', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, loadFixture('go-get-gitlab.html'));
      getDigestGitlabMock.mockResolvedValue('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { lookupName: 'gitlab.com/group/subgroup' },
        null
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });
    it('supports gitlab digest with a specific branch', async () => {
      const branch = 'some-branch';
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, loadFixture('go-get-gitlab.html'));
      getDigestGitlabMock.mockResolvedValue('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { lookupName: 'gitlab.com/group/subgroup' },
        branch
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });
    it('returns digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, loadFixture('go-get-github.html'));
      getDigestGithubMock.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { lookupName: 'golang.org/x/text' },
        null
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support bitbucket digest', async () => {
      getDigestBitbucketMock.mockResolvedValueOnce('123');
      const res = await datasource.getDigest(
        {
          lookupName: 'bitbucket.org/golang/text',
        },
        null
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
