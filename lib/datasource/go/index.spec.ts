import _got from '../../util/got';
import * as _github from '../github-tags';
import * as go from '.';
import { mocked, partial } from '../../../test/util';
import { ReleaseResult } from '..';

jest.mock('../../util/got');
jest.mock('../github-tags');

const got: any = mocked(_got);
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
    global.repoCache = {};
  });
  describe('getDigest', () => {
    it('returns null for wrong name', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      github.getDigest.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
      const res = await go.getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
    });
    it('returns digest', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      github.getDigest.mockResolvedValueOnce('abcdefabcdefabcdefabcdef');
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
      github.getPkgReleases.mockResolvedValueOnce({
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
      const githubRes = { releases: [1, 2] } as any;
      for (const pkg of packages) {
        github.getPkgReleases.mockResolvedValueOnce(
          partial<ReleaseResult>(githubRes)
        );
        expect(await go.getPkgReleases(pkg)).toEqual(githubRes);
      }
      expect(got).toHaveBeenCalledTimes(0);
      expect(github.getPkgReleases.mock.calls).toMatchSnapshot();
    });
    it('works for nested modules on github', async () => {
      got.mockClear();
      github.getPkgReleases.mockClear();
      const packages = [
        { lookupName: 'github.com/x/text/a' },
        { lookupName: 'github.com/x/text/b' },
      ];

      for (const pkg of packages) {
        github.getPkgReleases.mockResolvedValueOnce({
          releases: [{ version: 'a/v1.0.0' }, { version: 'b/v2.0.0' }],
        });
        const prefix = pkg.lookupName.split('/')[3];
        const result = await go.getPkgReleases(pkg);
        expect(result.releases).toHaveLength(1);
        expect(result.releases[0].version.startsWith(prefix));
      }
      expect(got).toHaveBeenCalledTimes(0);
      expect(github.getPkgReleases.mock.calls).toMatchSnapshot();
    });
    it('falls back to old behaviour', async () => {
      got.mockClear();
      github.getPkgReleases.mockClear();
      const packages = [
        { lookupName: 'github.com/x/text/a' },
        { lookupName: 'github.com/x/text/b' },
      ];

      const releases = {
        releases: [{ version: 'a/v1.0.0' }, { version: 'b/v2.0.0' }],
      };
      for (const pkg of packages) {
        github.getPkgReleases.mockResolvedValueOnce(releases);
        expect(await go.getPkgReleases(pkg)).toBe(releases);
      }
    });
  });
});
