import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, logger, mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { id as datasource, getDigest } from '.';

jest.mock('../../util/host-rules');

const hostRules = mocked(_hostRules);

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

const resGitLabEE = `<html>
<head>
	<meta name="go-import" content="my.custom.domain/golang/myrepo git https://my.custom.domain/golang/myrepo.git" />
	<meta name="go-source"
		content="my.custom.domain/golang/myrepo https://my.custom.domain/golang/myrepo https://my.custom.domain/golang/myrepo/-/tree/master{/dir} https://my.custom.domain/golang/myrepo/-/blob/master{/dir}/{file}#L{line}" />
</head>

<body>go get https://my.custom.domain/golang/myrepo</body>

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

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.setup();
    hostRules.find.mockReturnValue({});
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    httpMock.reset();
    jest.resetAllMocks();
  });

  describe('getDigest', () => {
    it('returns null for no go-source tag', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, '');
      const res = await getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for wrong name', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, res1);
      const res = await getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gitlab digest is not supported at the moment', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get('/golang/text?go-get=1')
        .reply(200, '');
      const res = await getDigest(
        { lookupName: 'gitlab.com/golang/text' },
        null
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, res1);
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/golang/text/commits?per_page=1')
        .reply(200, [{ sha: 'abcdefabcdefabcdefabcdef' }]);
      const res = await getDigest({ lookupName: 'golang.org/x/text' }, null);
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support bitbucket digest', async () => {
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/golang/text')
        .reply(200, { mainbranch: { name: 'master' } });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/golang/text/commits/master')
        .reply(200, {
          pagelen: 1,
          values: [
            {
              hash: '123',
              date: '2020-11-19T09:05:35+00:00',
            },
          ],
          page: 1,
        });
      const res = await getDigest(
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

  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/foo/something?go-get=1')
        .reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/foo/something',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/foo/something?go-get=1')
        .reply(404);
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/foo/something',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/foo/something?go-get=1')
        .replyWithError('error');
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/foo/something',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, res1);
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/golang/text/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }])
        .get('/repos/golang/text/releases?per_page=100')
        .reply(200, []);
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
      httpMock
        .scope('https://gitlab.com/')
        .get('/api/v4/projects/golang%2Ftext/repository/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await getPkgReleases({
        datasource,
        depName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support self hosted gitlab private repositories', async () => {
      hostRules.find.mockReturnValue({ token: 'some-token' });
      httpMock
        .scope('https://my.custom.domain/')
        .get('/golang/myrepo?go-get=1')
        .reply(200, resGitLabEE);
      httpMock
        .scope('https://my.custom.domain/')
        .get('/api/v4/projects/golang%2Fmyrepo/repository/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await getPkgReleases({
        datasource,
        depName: 'my.custom.domain/golang/myrepo',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support bitbucket tags', async () => {
      httpMock
        .scope('https://api.bitbucket.org/')
        .get('/2.0/repositories/golang/text/refs/tags')
        .reply(200, {
          pagelen: 2,
          page: 1,
          values: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }],
        });
      const res = await getPkgReleases({
        datasource,
        depName: 'bitbucket.org/golang/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('unknown datasource returns null', async () => {
      httpMock
        .scope('https://some.unknown.website/')
        .get('/example/module?go-get=1')
        .reply(200);
      const res = await getPkgReleases({
        datasource,
        depName: 'some.unknown.website/example/module',
      });
      expect(res).toMatchSnapshot();
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { lookupName: 'some.unknown.website/example/module' },
        'Unsupported dependency.'
      );
      expect(logger.logger.error).not.toHaveBeenCalled();
      expect(logger.logger.fatal).not.toHaveBeenCalled();
    });
    it('support ghe', async () => {
      httpMock
        .scope('https://git.enterprise.com/')
        .get('/example/module?go-get=1')
        .reply(200, resGitHubEnterprise);
      httpMock
        .scope('https://git.enterprise.com/')
        .get('/api/v3/repos/example/module/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }])
        .get('/api/v3/repos/example/module/releases?per_page=100')
        .reply(200, []);
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
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/x/text/tags?per_page=100')
        .reply(200, [])
        .get('/repos/x/text/releases?per_page=100')
        .reply(200, [])
        .get('/repos/x/text/tags?per_page=100')
        .reply(200, [])
        .get('/repos/x/text/releases?per_page=100')
        .reply(200, [])
        .get('/repos/go-x/x/tags?per_page=100')
        .reply(200, [])
        .get('/repos/go-x/x/releases?per_page=100')
        .reply(200, []);
      const packages = [
        { datasource, depName: 'github.com/x/text' },
        { datasource, depName: 'gopkg.in/x/text' },
        { datasource, depName: 'gopkg.in/x' },
      ];
      for (const pkg of packages) {
        const res = await getPkgReleases(pkg);
        expect(res.releases).toBeEmpty();
      }
      const httpCalls = httpMock.getTrace();
      expect(httpCalls).toHaveLength(6);
      expect(httpCalls).toMatchSnapshot();
    });
    it('works for nested modules on github', async () => {
      const packages = [
        { datasource, depName: 'github.com/x/text/a' },
        { datasource, depName: 'github.com/x/text/b' },
      ];
      const tags = [{ name: 'a/v1.0.0' }, { name: 'b/v2.0.0' }];

      for (const pkg of packages) {
        httpMock.setup();
        httpMock
          .scope('https://api.github.com/')
          .get('/repos/x/text/tags?per_page=100')
          .reply(200, tags)
          .get('/repos/x/text/releases?per_page=100')
          .reply(200, []);

        const prefix = pkg.depName.split('/')[3];
        const result = await getPkgReleases(pkg);
        expect(result.releases).toHaveLength(1);
        expect(result.releases[0].version.startsWith(prefix)).toBeFalse();

        const httpCalls = httpMock.getTrace();
        expect(httpCalls).toMatchSnapshot();
        httpMock.reset();
      }
    });
    it('returns none if no tags match submodules', async () => {
      const packages = [
        { datasource, depName: 'github.com/x/text/a' },
        { datasource, depName: 'github.com/x/text/b' },
      ];
      const tags = [{ name: 'v1.0.0' }, { name: 'v2.0.0' }];

      for (const pkg of packages) {
        httpMock.setup();
        httpMock
          .scope('https://api.github.com/')
          .get('/repos/x/text/tags?per_page=100')
          .reply(200, tags)
          .get('/repos/x/text/releases?per_page=100')
          .reply(200, []);

        const result = await getPkgReleases(pkg);
        expect(result.releases).toHaveLength(0);

        const httpCalls = httpMock.getTrace();
        expect(httpCalls).toMatchSnapshot();
        httpMock.reset();
      }
    });
    it('works for nested modules on github v2+ major upgrades', async () => {
      const pkg = { datasource, depName: 'github.com/x/text/b/v2' };
      const tags = [
        { name: 'a/v1.0.0' },
        { name: 'v5.0.0' },
        { name: 'b/v2.0.0' },
        { name: 'b/v3.0.0' },
      ];

      httpMock
        .scope('https://api.github.com/')
        .get('/repos/x/text/tags?per_page=100')
        .reply(200, tags)
        .get('/repos/x/text/releases?per_page=100')
        .reply(200, []);

      const result = await getPkgReleases(pkg);
      expect(result.releases).toEqual([
        { gitRef: 'b/v2.0.0', version: 'v2.0.0' },
        { gitRef: 'b/v3.0.0', version: 'v3.0.0' },
      ]);

      const httpCalls = httpMock.getTrace();
      expect(httpCalls).toMatchSnapshot();
    });
    it('handles fyne.io', async () => {
      httpMock
        .scope('https://fyne.io/')
        .get('/fyne?go-get=1')
        .reply(
          200,
          '<meta name="go-import" content="fyne.io/fyne git https://github.com/fyne-io/fyne">'
        );
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/fyne-io/fyne/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }])
        .get('/repos/fyne-io/fyne/releases?per_page=100')
        .reply(200, []);
      const res = await getPkgReleases({
        datasource,
        depName: 'fyne.io/fyne',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
