import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { HttpError } from '../../../util/http/index.ts';
import { getDigest, getPkgReleases } from '../index.ts';
import { UnpkgDatasource } from './index.ts';

const baseUrl = 'https://unpkg.com/';

function pathFor(s: string): string {
  return `/${s}@latest?meta`;
}

function pathForDigest(s: string, version: string): string {
  const parts = s.split('/');
  const library = s.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return `/${library}@${version}?meta`;
}

describe('modules/datasource/unpkg/index', () => {
  describe('getReleases', () => {
    it('throws for empty result', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(200, '}');
      await expect(
        getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for error', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(404);
      expect(
        await getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('doesnotexist/doesnotexist'))
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'doesnotexist/doesnotexist',
        }),
      ).toBeNull();
    });

    it('throws for 401', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(401);
      await expect(
        getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 429', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(429);
      await expect(
        getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(502);
      await expect(
        getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for unknown error', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real npm data (scoped)', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('@popperjs/core'))
        .reply(200, Fixtures.get('scoped_popperjs_core.json'));
      const res = await getPkgReleases({
        datasource: UnpkgDatasource.id,
        packageName: '@popperjs/core',
      });

      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[res?.releases.length - 1].version).toBe('2.11.8');
      expect(res?.registryUrl).toBe(baseUrl);
    });

    it('processes real npm data (unscoped)', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('jquery'))
        .reply(200, Fixtures.get('unscoped_jquery.json'));
      const res = await getPkgReleases({
        datasource: UnpkgDatasource.id,
        packageName: 'jquery',
      });

      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[res?.releases.length - 1].version).toBe('4.0.0');
      expect(res?.registryUrl).toBe(baseUrl);
    });
  });

  describe('getDigest', () => {
    it('returs null for no result', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('foo/bar', '1.2.0'))
        .reply(200, '{}');

      const res = await getDigest(
        {
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returs null for empty sri object', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('foo/bar', '1.2.0'))
        .reply(200, JSON.stringify({ sri: {} }));

      const res = await getDigest(
        {
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returs null if file not found', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('foo/bar', '1.2.0'))
        .reply(200, JSON.stringify({ sri: { string: 'hash' } }));

      const res = await getDigest(
        {
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returs null if matching file has no integrity', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('foo/bar', '1.2.0'))
        .reply(200, JSON.stringify({ files: [{ path: '/bar' }] }));

      const res = await getDigest(
        {
          datasource: UnpkgDatasource.id,
          packageName: 'foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(pathForDigest('foo/bar', '1.2.0')).reply(404);
      await expect(
        getDigest(
          {
            datasource: UnpkgDatasource.id,
            packageName: 'foo/bar',
          },
          '1.2.0',
        ),
      ).rejects.toThrow(HttpError);
    });

    it('returns digest', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('jquery/dist/jquery.min.js', '4.0.0'))
        .reply(200, Fixtures.get('unscoped_jquery.json'));

      const res = await getDigest(
        {
          datasource: UnpkgDatasource.id,
          packageName: 'jquery/dist/jquery.min.js',
        },
        '4.0.0',
      );
      expect(res).toBe('sha256-OaVG6prZf4v69dPg6PhVattBXkcOWQB62pdZ3ORyrao=');
    });

    it('returns digest for scoped package', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('@popperjs/core/lib/index.js', '2.11.8'))
        .reply(200, Fixtures.get('scoped_popperjs_core.json'));

      const res = await getDigest(
        {
          datasource: UnpkgDatasource.id,
          packageName: '@popperjs/core/lib/index.js',
        },
        '2.11.8',
      );
      expect(res).toBe('sha256-UqkAFbzZZwTVGU3Es2nAXtH0+jto8SgHJmKdKajwaFE=');
    });
  });
});
