import { mockDeep } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import * as _hostRules from '../../../util/host-rules.ts';
import type { ReleaseResult } from '../index.ts';
import { getPkgReleases } from '../index.ts';
import { GoDatasource } from './index.ts';

vi.mock('../../../util/host-rules.ts', () => mockDeep());
const hostRules = vi.mocked(_hostRules);

const getReleasesDirectMock = vi.fn();

const getDigestForgejoMock = vi.fn();
const getDigestGiteaMock = vi.fn();
const getDigestGithubMock = vi.fn();
const getDigestGitlabMock = vi.fn();
const getDigestGitMock = vi.fn();
const getDigestBitbucketMock = vi.fn();
vi.mock('./releases-direct.ts', () => {
  return {
    GoDirectDatasource: vi.fn(
      class {
        forgejo = {
          getDigest: (...args: any[]) => getDigestForgejoMock(...args),
        };
        git = { getDigest: (...args: any[]) => getDigestGitMock(...args) };
        gitea = { getDigest: (...args: any[]) => getDigestGiteaMock(...args) };
        github = {
          getDigest: (...args: any[]) => getDigestGithubMock(...args),
        };
        gitlab = {
          getDigest: (...args: any[]) => getDigestGitlabMock(...args),
        };
        bitbucket = {
          getDigest: (...args: any[]) => getDigestBitbucketMock(...args),
        };
        getReleases = (...args: any[]) => getReleasesDirectMock(...args);
      },
    ),
  };
});

const getReleasesProxyMock = vi.fn();
vi.mock('./releases-goproxy.ts', () => {
  return {
    GoProxyDatasource: vi.fn(
      class {
        getReleases = () => getReleasesProxyMock();
      },
    ),
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
      expect(getDigestGithubMock).toHaveBeenCalledExactlyOnceWith(
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
      expect(getDigestGithubMock).toHaveBeenCalledExactlyOnceWith(
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

    it('support forgejo digest', async () => {
      getDigestForgejoMock.mockResolvedValueOnce('123');
      const res = await datasource.getDigest(
        {
          packageName: 'code.forgejo.org/go-chi/cache',
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

  describe('using getPkgReleases', () => {
    beforeEach(() => {
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    afterEach(() => {
      delete process.env.GOPROXY;
    });

    describe('constraints', () => {
      // TODO deprecated #42600
      it('are respected based on an exact match on the `go` constraint', async () => {
        const expected: ReleaseResult = {
          releases: [
            // Go 1.24
            {
              version: 'v0.32.0',
              constraints: {
                go: ['1.24.0'],
              },
            },
            {
              version: 'v0.33.0',
              constraints: {
                go: ['1.24.2'],
              },
            },
            // Go 1.25
            {
              version: 'v0.34.0',
              constraints: {
                go: ['1.25.0'],
              },
            },
          ],
        };

        getReleasesProxyMock.mockResolvedValue(expected);
        getReleasesDirectMock.mockResolvedValue(null);

        const res = await getPkgReleases({
          datasource: GoDatasource.id,
          packageName: 'golang.org/x/mod',

          constraints: { go: '1.24.0' },
          constraintsFiltering: 'strict',
        });

        expect(res).toBeDefined();
        expect(res?.releases).toHaveLength(1);
        expect(res?.releases[0].version).toEqual('v0.32.0');
      });

      it('are respected based on a SemVer-style range based on the `%goMod` constraint', async () => {
        const expected: ReleaseResult = {
          releases: [
            // Go 1.24
            {
              version: 'v0.32.0',
              constraints: {
                '%goMod': ['1.24.0'],
              },
            },
            {
              version: 'v0.33.0',
              constraints: {
                '%goMod': ['1.24.1'],
              },
            },
            // Go 1.25
            {
              version: 'v0.34.0',
              constraints: {
                '%goMod': ['1.25.0'],
              },
            },
          ],
        };

        getReleasesProxyMock.mockResolvedValue(expected);
        getReleasesDirectMock.mockResolvedValue(null);

        const res = await getPkgReleases({
          datasource: GoDatasource.id,
          packageName: 'golang.org/x/mod',
          constraints: { '%goMod': '~1.24.x' },
          constraintsFiltering: 'strict',
          constraintsVersioning: {
            '%goMod': 'semver-coerced',
          },
        });

        expect(res).toBeDefined();
        expect(res?.releases).toHaveLength(2);
        expect(res?.releases[0].version).toEqual('v0.32.0');
        expect(res?.releases[1].version).toEqual('v0.33.0');
      });
    });
  });
});
