import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { HttpError } from '../../../util/http/index.ts';
import { getDigest, getPkgReleases } from '../index.ts';
import { NpmDatasource } from '../npm/index.ts';
import { UnpkgDatasource } from './index.ts';

const baseUrl = 'https://unpkg.com/';

function pathForDigest(s: string, version: string): string {
  const parts = s.split('/');
  const library = s.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return `/${library}@${version}?meta`;
}

describe('modules/datasource/unpkg/index', () => {
  describe('getReleases', () => {
    it('forwards the config to NpmDatasource and returns its result', async () => {
      const releaseResult = {
        releases: [{ version: '4.0.0' }],
      };
      const getReleasesSpy = vi
        .spyOn(NpmDatasource.prototype, 'getReleases')
        .mockResolvedValueOnce(releaseResult);

      const res = await getPkgReleases({
        datasource: UnpkgDatasource.id,
        packageName: 'jquery',
      });

      expect(res).toEqual(releaseResult);
      expect(getReleasesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ packageName: 'jquery' }),
      );
    });

    it('returns null when NpmDatasource returns null', async () => {
      vi.spyOn(NpmDatasource.prototype, 'getReleases').mockResolvedValueOnce(
        null,
      );

      expect(
        await getPkgReleases({
          datasource: UnpkgDatasource.id,
          packageName: 'does-not-exist',
        }),
      ).toBeNull();
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
