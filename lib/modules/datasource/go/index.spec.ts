import { mockDeep } from 'jest-mock-extended';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { GoDatasource } from '.';

jest.mock('../../../util/host-rules', () => mockDeep());
const hostRules = mocked(_hostRules);

const getReleasesDirectMock = jest.fn();

const getDigestGiteaMock = jest.fn();
const getDigestGithubMock = jest.fn();
const getDigestGitlabMock = jest.fn();
const getDigestGitMock = jest.fn();
const getDigestBitbucketMock = jest.fn();
jest.mock('./releases-direct', () => {
  return {
    GoDirectDatasource: jest.fn().mockImplementation(() => {
      return {
        git: { getDigest: (...args: any[]) => getDigestGitMock(...args) },
        gitea: { getDigest: (...args: any[]) => getDigestGiteaMock(...args) },
        github: { getDigest: (...args: any[]) => getDigestGithubMock(...args) },
        gitlab: { getDigest: (...args: any[]) => getDigestGitlabMock(...args) },
        bitbucket: {
          getDigest: (...args: any[]) => getDigestBitbucketMock(...args),
        },
        getReleases: (...args: any[]) => getReleasesDirectMock(...args),
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

describe('modules/datasource/go/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    afterEach(() => {
      delete process.env.GOPROXY;
    });

    it('fetches releases', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      getReleasesProxyMock.mockResolvedValue(expected);
      getReleasesDirectMock.mockResolvedValue(null);

      const res = await datasource.getReleases({
        packageName: 'golang.org/foo/bar',
      });

      expect(res).toBe(expected);
      expect(getReleasesProxyMock).toHaveBeenCalled();
      expect(getReleasesDirectMock).not.toHaveBeenCalled();
    });
  });

  describe('getDigest', () => {
    beforeEach(() => {
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    it('returns null for no go-source tag', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, '');
      const res = await datasource.getDigest(
        { packageName: 'golang.org/y/text' },
        undefined,
      );
      expect(res).toBeNull();
    });

    it('returns null for wrong name', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, Fixtures.get('go-get-github.html'));
      const res = await datasource.getDigest(
        { packageName: 'golang.org/y/text' },
        undefined,
      );
      expect(res).toBeNull();
    });

    it('supports gitlab digest', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, Fixtures.get('go-get-gitlab.html'));
      getDigestGitlabMock.mockResolvedValue('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { packageName: 'gitlab.com/group/subgroup' },
        undefined,
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });

    it('supports git digest', async () => {
      httpMock
        .scope('https://renovatebot.com/')
        .get('/abc/def?go-get=1')
        .reply(200, Fixtures.get('go-get-git-digest.html'));
      getDigestGitMock.mockResolvedValue('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { packageName: 'renovatebot.com/abc/def' },
        undefined,
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });

    it('supports gitlab digest with a specific branch', async () => {
      const branch = 'some-branch';
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, Fixtures.get('go-get-gitlab.html'));
      getDigestGitlabMock.mockResolvedValue('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { packageName: 'gitlab.com/group/subgroup' },
        branch,
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });

    it('returns github digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, Fixtures.get('go-get-github.html'));
      getDigestGithubMock.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { packageName: 'golang.org/x/text' },
        'v1.2.3',
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(getDigestGithubMock).toHaveBeenCalledWith(
        {
          datasource: 'github-tags',
          packageName: 'golang/text',
          registryUrl: 'https://github.com',
        },
        'v1.2.3',
      );
    });

    it('returns github default branch digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, Fixtures.get('go-get-github.html'));
      getDigestGithubMock.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { packageName: 'golang.org/x/text' },
        'v0.0.0',
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(getDigestGithubMock).toHaveBeenCalledWith(
        {
          datasource: 'github-tags',
          packageName: 'golang/text',
          registryUrl: 'https://github.com',
        },
        undefined,
      );
    });

    it('support bitbucket digest', async () => {
      getDigestBitbucketMock.mockResolvedValueOnce('123');
      const res = await datasource.getDigest(
        {
          packageName: 'bitbucket.org/golang/text',
        },
        undefined,
      );
      expect(res).toBe('123');
    });

    it('support gitea digest', async () => {
      getDigestGiteaMock.mockResolvedValueOnce('123');
      const res = await datasource.getDigest(
        {
          packageName: 'gitea.com/go-chi/cache',
        },
        undefined,
      );
      expect(res).toBe('123');
    });

    describe('GOPROXY', () => {
      afterEach(() => {
        delete process.env.GOPROXY;
      });

      it('returns null when GOPROXY contains off', async () => {
        process.env.GOPROXY = 'https://proxy.golang.org,off';
        const res = await datasource.getDigest(
          { packageName: 'golang.org/x/text' },
          'v1.2.3',
        );
        expect(res).toBeNull();
      });
    });
  });
});
