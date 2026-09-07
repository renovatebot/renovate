import * as httpMock from '~test/http-mock.ts';
import { ForgejoHttp } from '../http/forgejo.ts';
import { GiteaHttp } from '../http/gitea.ts';
import { toBase64 } from '../string.ts';
import { API_BASE_PATH, getRepoFile, listRepoDir } from './contents.ts';

describe('util/gitea/contents', () => {
  const apiHost = 'https://gitea.renovatebot.com';
  const apiBaseUrl = `${apiHost}/api/v1/`;
  const giteaHttp = new GiteaHttp();
  const forgejoHttp = new ForgejoHttp();

  describe('getRepoFile', () => {
    it('reads a file and decodes its content', async () => {
      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents/dummy.txt')
        .reply(200, {
          type: 'file',
          name: 'dummy.txt',
          path: 'dummy.txt',
          content: toBase64('top secret'),
        });

      const res = await getRepoFile(
        giteaHttp,
        apiBaseUrl,
        'some/repo',
        'dummy.txt',
      );

      expect(res).toEqual({
        type: 'file',
        name: 'dummy.txt',
        path: 'dummy.txt',
        content: toBase64('top secret'),
        contentString: 'top secret',
      });
    });

    it('supports passing a ref by query', async () => {
      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents/dummy.txt?ref=dev')
        .reply(200, {
          type: 'file',
          name: 'dummy.txt',
          path: 'dummy.txt',
          content: null,
        });

      const res = await getRepoFile(
        forgejoHttp,
        apiBaseUrl,
        'some/repo',
        'dummy.txt',
        'dev',
      );

      expect(res).toMatchObject({ type: 'file', contentString: '' });
    });

    it('escapes the file path', async () => {
      httpMock
        .scope(apiHost)
        .get(
          `/api/v1/repos/some/repo/contents/${encodeURIComponent('nested/path/dummy.txt')}`,
        )
        .reply(200, {
          type: 'symlink',
          name: 'dummy.txt',
          path: 'nested/path/dummy.txt',
        });

      const res = await getRepoFile(
        giteaHttp,
        apiBaseUrl,
        'some/repo',
        'nested/path/dummy.txt',
      );

      expect(res).toEqual({
        type: 'symlink',
        name: 'dummy.txt',
        path: 'nested/path/dummy.txt',
      });
    });

    it('resolves the default API path against a baseUrl option', async () => {
      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents/dummy.txt')
        .reply(200, {
          type: 'file',
          name: 'dummy.txt',
          path: 'dummy.txt',
          content: toBase64('data'),
        });

      const res = await getRepoFile(
        giteaHttp,
        API_BASE_PATH,
        'some/repo',
        'dummy.txt',
        null,
        { baseUrl: `${apiHost}/` },
      );

      expect(res).toMatchObject({ contentString: 'data' });
    });
  });

  describe('listRepoDir', () => {
    it('lists the repository root', async () => {
      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents')
        .reply(200, [
          { type: 'dir', name: 'docs', path: 'docs' },
          { type: 'submodule', name: 'sub', path: 'sub' },
        ]);

      const res = await listRepoDir(forgejoHttp, apiBaseUrl, 'some/repo');

      expect(res).toEqual([
        { type: 'dir', name: 'docs', path: 'docs' },
        { type: 'submodule', name: 'sub', path: 'sub' },
      ]);
    });

    it('lists a subdirectory', async () => {
      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents/docs')
        .reply(200, []);

      const res = await listRepoDir(
        giteaHttp,
        apiBaseUrl,
        'some/repo',
        'docs',
        { paginate: false },
      );

      expect(res).toBeEmptyArray();
    });
  });
});
