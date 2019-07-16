const got = require('../../lib/util/got');
/** @type any */
const github = require('../../lib/datasource/github');
const go = require('../../lib/datasource/go');

jest.mock('../../lib/util/got');
jest.mock('../../lib/datasource/github');

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
    global.repoCache = {};
  });
  describe('getDigest', () => {
    it('returns null for wrong name', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      github.getDigest.mockReturnValueOnce('abcdefabcdefabcdefabcdef');
      const res = await go.getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
    });
    it('returns digest', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      github.getDigest.mockReturnValueOnce('abcdefabcdefabcdefabcdef');
      const res = await go.getDigest({ lookupName: 'golang.org/x/text' }, null);
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });
  });
  describe('getPkgReleases', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await go.getPkgReleases({
          lookupName: 'golang.org/foo/something',
        })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await go.getPkgReleases({
          lookupName: 'golang.org/foo/something',
        })
      ).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await go.getPkgReleases({
          lookupName: 'golang.org/foo/something',
        })
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      github.getPkgReleases.mockReturnValueOnce({
        releases: [{ version: 'v1.0.0' }, { version: 'v2.0.0' }],
      });
      const res = await go.getPkgReleases({
        lookupName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('skips wrong package', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await go.getPkgReleases({
        lookupName: 'golang.org/x/sys',
      });
      expect(res).toBeNull();
    });
    it('skips unsupported platform', async () => {
      got.mockReturnValueOnce({
        body: res1.replace(
          'https://github.com/golang/text/',
          'https://google.com/golang/text/'
        ),
      });
      const res = await go.getPkgReleases({
        lookupName: 'golang.org/x/text',
      });
      expect(res).toBeNull();
    });
    it('works for known servers', async () => {
      got.mockClear();
      github.getPkgReleases.mockClear();
      const packages = [
        { lookupName: 'github.com/x/text' },
        { lookupName: 'gopkg.in/x/text' },
        { lookupName: 'gopkg.in/x' },
      ];
      const githubRes = { releases: [1, 2] };
      for (const pkg of packages) {
        github.getPkgReleases.mockReturnValueOnce(githubRes);
        expect(await go.getPkgReleases(pkg)).toEqual(githubRes);
      }
      expect(got).toHaveBeenCalledTimes(0);
      expect(github.getPkgReleases.mock.calls).toMatchSnapshot();
    });
  });
});
