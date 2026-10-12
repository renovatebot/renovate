import * as httpMock from '~test/http-mock.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { GiteaHttp, setBaseUrl } from '../../../util/http/gitea.ts';
import { toBase64 } from '../../../util/string.ts';
import { getRepoFile, listRepoDir } from './files.ts';

describe('modules/platform/gitea/files', () => {
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

      const res = await getRepoFile(giteaHttp, 'some/repo', 'dummy.txt', null, {
        baseUrl: apiBaseUrl,
      });

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
        'some/repo',
        'dummy.txt',
        'dev',
        { baseUrl: apiBaseUrl },
      );

      expect(res).toMatchObject({ type: 'file', contentString: '' });
    });

    it('escapes each path segment but keeps the slashes', async () => {
      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents/nested/some%20path/dummy.txt')
        .reply(200, {
          type: 'symlink',
          name: 'dummy.txt',
          path: 'nested/some path/dummy.txt',
        });

      const res = await getRepoFile(
        giteaHttp,
        'some/repo',
        'nested/some path/dummy.txt',
        null,
        { baseUrl: apiBaseUrl },
      );

      expect(res).toEqual({
        type: 'symlink',
        name: 'dummy.txt',
        path: 'nested/some path/dummy.txt',
      });
    });

    it('falls back to the client base url', async () => {
      setBaseUrl(apiBaseUrl);

      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents/dummy.txt')
        .reply(200, {
          type: 'file',
          name: 'dummy.txt',
          path: 'dummy.txt',
          content: toBase64('data'),
        });

      const res = await getRepoFile(giteaHttp, 'some/repo', 'dummy.txt');

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

      const res = await listRepoDir(forgejoHttp, 'some/repo', undefined, {
        baseUrl: apiBaseUrl,
      });

      expect(res).toEqual([
        { type: 'dir', name: 'docs', path: 'docs' },
        { type: 'submodule', name: 'sub', path: 'sub' },
      ]);
    });

    it('lists a nested subdirectory', async () => {
      httpMock
        .scope(apiHost)
        .get('/api/v1/repos/some/repo/contents/charts/some')
        .reply(200, []);

      const res = await listRepoDir(giteaHttp, 'some/repo', 'charts/some', {
        baseUrl: apiBaseUrl,
        paginate: false,
      });

      expect(res).toBeEmptyArray();
    });
  });
});
