import { ReleaseResult } from '..';
import * as httpMock from '../../../test/httpMock';
import { mocked, partial } from '../../../test/util';
import * as _github from '../github-tags';
import * as go from '.';

jest.mock('../github-tags');

const github = mocked(_github);

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

describe('datasource/go', () => {
  beforeEach(() => {
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  describe('getDigest', () => {
    it('returns null for wrong name', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, res1);
      github.getDigest.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await go.getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, res1);
      github.getDigest.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await go.getDigest({ lookupName: 'golang.org/x/text' }, null);
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
        await go.getReleases({
          lookupName: 'golang.org/foo/something',
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
        await go.getReleases({
          lookupName: 'golang.org/foo/something',
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
        await go.getReleases({
          lookupName: 'golang.org/foo/something',
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
      const res = await go.getReleases({
        lookupName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('skips wrong package', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/sys?go-get=1')
        .reply(200, res1);
      const res = await go.getReleases({
        lookupName: 'golang.org/x/sys',
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
      const res = await go.getReleases({
        lookupName: 'golang.org/x/text',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('works for known servers', async () => {
      github.getReleases.mockClear();
      const packages = [
        { lookupName: 'github.com/x/text' },
        { lookupName: 'gopkg.in/x/text' },
        { lookupName: 'gopkg.in/x' },
      ];
      const githubRes = { releases: [1, 2] } as any;
      for (const pkg of packages) {
        github.getReleases.mockResolvedValueOnce(
          partial<ReleaseResult>(githubRes)
        );
        expect(await go.getReleases(pkg)).toEqual(githubRes);
      }
      expect(github.getReleases.mock.calls).toMatchSnapshot();
    });
    it('works for nested modules on github', async () => {
      github.getReleases.mockClear();
      const packages = [
        { lookupName: 'github.com/x/text/a' },
        { lookupName: 'github.com/x/text/b' },
      ];

      for (const pkg of packages) {
        github.getReleases.mockResolvedValueOnce({
          releases: [{ version: 'a/v1.0.0' }, { version: 'b/v2.0.0' }],
        });
        const prefix = pkg.lookupName.split('/')[3];
        const result = await go.getReleases(pkg);
        expect(result.releases).toHaveLength(1);
        expect(result.releases[0].version.startsWith(prefix)).toBeFalse();
      }
      expect(github.getReleases.mock.calls).toMatchSnapshot();
    });
    it('falls back to old behaviour', async () => {
      github.getReleases.mockClear();
      const packages = [
        { lookupName: 'github.com/x/text/a' },
        { lookupName: 'github.com/x/text/b' },
      ];

      const releases = {
        releases: [{ version: 'v1.0.0' }, { version: 'v2.0.0' }],
      };
      for (const pkg of packages) {
        github.getReleases.mockResolvedValueOnce(releases);
        expect(await go.getReleases(pkg)).toBe(releases);
      }
    });
  });
});
