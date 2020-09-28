import { ReleaseResult, getPkgReleases } from '..';
import * as httpMock from '../../../test/httpMock';
import { mocked, partial } from '../../../test/util';
import * as _github from '../github-tags';
import * as _gitlab from '../gitlab-tags';
import { id as datasource, getDigest } from '.';

jest.mock('../github-tags');
jest.mock('../gitlab-tags');

const github = mocked(_github);
const gitlab = mocked(_gitlab);

const res1 = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<meta name="go-import" content="golang.org/x/text git https://go.googlesource.com/text">
<meta name="go-source" content="golang.org/x/text https://github.com/golang/text/ https://github.com/golang/text/tree/master{/dir} https://github.com/golang/text/blob/master{/dir}/{file}#L{line}">
<meta http-equiv="refresh" content="0; url=https://godoc.org/golang.org/x/text">
</head>
<body>
Nothing to see here; <a href="https://godoc.org/golang.org/x/text">move along</a>.
</body>
</html>`;

const resGitHubEnterprise = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">

<title>Go remote import path metadata</title>
<meta name="go-import" content="git.enterprise.com/example/module git https://git.enterprise.com/example/module.git">
</head>

<body>
<!-- Metadata for Go remote import path -->
</body>
</html>`;

describe('datasource/go', () => {
  beforeEach(() => {
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  describe('getDigest', () => {
    it('returns null for no go-source tag', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, '');
      github.getDigest.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for wrong name', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, res1);
      github.getDigest.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, res1);
      github.getDigest.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await getDigest({ lookupName: 'golang.org/x/text' }, null);
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/foo/something?go-get=1')
        .reply(200, res1);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'golang.org/foo/something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/foo/something?go-get=1')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'golang.org/foo/something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/foo/something?go-get=1')
        .replyWithError('error');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'golang.org/foo/something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, res1);
      github.getReleases.mockResolvedValueOnce({
        releases: [{ version: 'v1.0.0' }, { version: 'v2.0.0' }],
      });
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support gitlab', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(
          200,
          res1.replace(
            'https://github.com/golang/text/',
            'https://gitlab.com/golang/text/'
          )
        );
      gitlab.getReleases.mockResolvedValueOnce({
        releases: [{ version: 'v1.0.0' }, { version: 'v2.0.0' }],
      });
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support ghe', async () => {
      httpMock
        .scope('https://git.enterprise.com/')
        .get('/example/module?go-get=1')
        .reply(200, resGitHubEnterprise);
      github.getReleases.mockResolvedValueOnce({
        releases: [{ version: 'v1.0.0' }, { version: 'v2.0.0' }],
      });
      const res = await getPkgReleases({
        datasource,
        depName: 'git.enterprise.com/example/module',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for go-import prefix mismatch', async () => {
      httpMock
        .scope('https://git.enterprise.com/')
        .get('/example/module?go-get=1')
        .reply(
          200,
          resGitHubEnterprise.replace(
            'git.enterprise.com/example/module',
            'git.enterprise.com/badexample/badmodule'
          )
        );
      const res = await getPkgReleases({
        datasource,
        depName: 'git.enterprise.com/example/module',
      });
      expect(res).toBeNull();
    });
    it('skips wrong package', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/sys?go-get=1')
        .reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/x/sys',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('skips unsupported platform', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(
          200,
          res1.replace(
            'https://github.com/golang/text/',
            'https://google.com/golang/text/'
          )
        );
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/x/text',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('works for known servers', async () => {
      github.getReleases.mockClear();
      const packages = [
        { datasource, depName: 'github.com/x/text' },
        { datasource, depName: 'gopkg.in/x/text' },
        { datasource, depName: 'gopkg.in/x' },
      ];
      const githubRes = {
        releases: [],
      } as any;
      for (const pkg of packages) {
        github.getReleases.mockResolvedValueOnce(
          partial<ReleaseResult>(githubRes)
        );
        expect(await getPkgReleases(pkg)).toBeNull();
      }
      expect(github.getReleases.mock.calls).toMatchSnapshot();
    });
    it('works for nested modules on github', async () => {
      github.getReleases.mockClear();
      const packages = [
        { datasource, depName: 'github.com/x/text/a' },
        { datasource, depName: 'github.com/x/text/b' },
      ];

      for (const pkg of packages) {
        github.getReleases.mockResolvedValueOnce({
          releases: [{ version: 'a/v1.0.0' }, { version: 'b/v2.0.0' }],
        });
        const prefix = pkg.depName.split('/')[3];
        const result = await getPkgReleases(pkg);
        expect(result.releases).toHaveLength(1);
        expect(result.releases[0].version.startsWith(prefix)).toBeFalse();
      }
      expect(github.getReleases.mock.calls).toMatchSnapshot();
    });
    it('falls back to old behaviour', async () => {
      github.getReleases.mockClear();
      const packages = [
        { datasource, depName: 'github.com/x/text/a' },
        { datasource, depName: 'github.com/x/text/b' },
      ];

      const releases = {
        releases: [{ version: 'v1.0.0' }, { version: 'v2.0.0' }],
      };
      for (const pkg of packages) {
        github.getReleases.mockResolvedValueOnce(releases);
        expect(await getPkgReleases(pkg)).toStrictEqual(releases);
      }
    });
  });
});
