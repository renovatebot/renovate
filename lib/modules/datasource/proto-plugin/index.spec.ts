import { codeBlock } from 'common-tags';
import * as httpMock from '~test/http-mock.ts';
import { fs } from '~test/util.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import { ProtoPluginDatasource } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const datasource = new ProtoPluginDatasource();

const githubGetReleases = vi.spyOn(
  GithubTagsDatasource.prototype,
  'getReleases',
);
const gitlabGetReleases = vi.spyOn(
  GitlabTagsDatasource.prototype,
  'getReleases',
);

const pluginUrl = 'https://example.com/plugins/buf.toml';

describe('modules/datasource/proto-plugin/index', () => {
  describe('getReleases', () => {
    it('delegates a remote github plugin to the github tags datasource', async () => {
      httpMock
        .scope('https://example.com')
        .get('/plugins/buf.toml')
        .reply(
          200,
          codeBlock`
            [resolve]
            git-url = "https://github.com/bufbuild/buf"
          `,
        );
      const delegateResult = {
        sourceUrl: 'https://github.com/bufbuild/buf',
        releases: [{ version: 'v1.70.0' }, { version: 'v1.71.0' }],
      };
      githubGetReleases.mockResolvedValueOnce(delegateResult);

      const res = await datasource.getReleases({ packageName: pluginUrl });

      expect(githubGetReleases).toHaveBeenCalledWith({
        packageName: 'bufbuild/buf',
        registryUrl: 'https://github.com',
      });
      // Returned verbatim; the `v`-strip is the manager's extractVersion.
      expect(res).toEqual(delegateResult);
    });

    it('delegates a remote gitlab plugin to the gitlab tags datasource', async () => {
      httpMock
        .scope('https://example.com')
        .get('/plugins/glab.toml')
        .reply(
          200,
          codeBlock`
            [resolve]
            git-url = "https://gitlab.com/gitlab-org/cli"
          `,
        );
      const delegateResult = {
        sourceUrl: 'https://gitlab.com/gitlab-org/cli',
        releases: [{ version: 'v1.0.0' }],
      };
      gitlabGetReleases.mockResolvedValueOnce(delegateResult);

      const res = await datasource.getReleases({
        packageName: 'https://example.com/plugins/glab.toml',
      });

      expect(gitlabGetReleases).toHaveBeenCalledWith({
        packageName: 'gitlab-org/cli',
        registryUrl: 'https://gitlab.com',
      });
      expect(res).toEqual(delegateResult);
    });

    it('returns null when the plugin repo host is unsupported', async () => {
      httpMock
        .scope('https://example.com')
        .get('/plugins/weird.toml')
        .reply(
          200,
          codeBlock`
            [resolve]
            git-url = "https://bitbucket.org/foo/bar"
          `,
        );

      const res = await datasource.getReleases({
        packageName: 'https://example.com/plugins/weird.toml',
      });
      expect(res).toBeNull();
    });

    it('returns null when the plugin toml has no repo url', async () => {
      httpMock
        .scope('https://example.com')
        .get('/plugins/empty.toml')
        .reply(200, codeBlock`name = "empty"`);

      const res = await datasource.getReleases({
        packageName: 'https://example.com/plugins/empty.toml',
      });
      expect(res).toBeNull();
    });

    it('passes through a null delegate result', async () => {
      httpMock
        .scope('https://example.com')
        .get('/plugins/glab.toml')
        .reply(
          200,
          codeBlock`
            [resolve]
            git-url = "https://gitlab.com/gitlab-org/cli"
          `,
        );
      gitlabGetReleases.mockResolvedValueOnce(null);

      const res = await datasource.getReleases({
        packageName: 'https://example.com/plugins/glab.toml',
      });
      expect(res).toBeNull();
    });

    it('returns null when the plugin is not found', async () => {
      httpMock
        .scope('https://example.com')
        .get('/plugins/gone.toml')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'https://example.com/plugins/gone.toml',
      });
      expect(res).toBeNull();
    });

    it('throws an external host error on a server error', async () => {
      httpMock
        .scope('https://example.com')
        .get('/plugins/flaky.toml')
        .reply(503);

      await expect(
        datasource.getReleases({
          packageName: 'https://example.com/plugins/flaky.toml',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('resolves a local plugin path', async () => {
      fs.isValidLocalPath.mockReturnValue(true);
      fs.readLocalFile.mockResolvedValue(codeBlock`
        [resolve]
        git-url = "https://github.com/direnv/direnv"
      `);
      const delegateResult = {
        sourceUrl: 'https://github.com/direnv/direnv',
        releases: [{ version: 'v2.37.1' }],
      };
      githubGetReleases.mockResolvedValueOnce(delegateResult);

      const res = await datasource.getReleases({
        packageName: '.proto/plugins/direnv.toml',
      });

      expect(fs.readLocalFile).toHaveBeenCalledWith(
        '.proto/plugins/direnv.toml',
        'utf8',
      );
      expect(res).toEqual(delegateResult);
    });

    it('returns null when a local plugin path escapes the repository', async () => {
      fs.isValidLocalPath.mockReturnValue(false);

      const res = await datasource.getReleases({
        packageName: '../../../../etc/passwd',
      });
      expect(res).toBeNull();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('returns null when a local plugin file is missing', async () => {
      fs.isValidLocalPath.mockReturnValue(true);
      fs.readLocalFile.mockResolvedValue(null);

      const res = await datasource.getReleases({
        packageName: '.proto/plugins/missing.toml',
      });
      expect(res).toBeNull();
    });

    it('returns null when a local plugin file is invalid TOML', async () => {
      fs.isValidLocalPath.mockReturnValue(true);
      fs.readLocalFile.mockResolvedValue('{{invalid');

      const res = await datasource.getReleases({
        packageName: '.proto/plugins/bad.toml',
      });
      expect(res).toBeNull();
    });
  });
});
