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
        .reply(200, {
          package: 'jquery',
          version: '4.0.0',
          prefix: '/',
          files: [
            {
              path: '/dist/jquery.js',
              size: 255967,
              type: 'text/javascript',
              integrity: 'sha256-9fsHeVnKBvqh3FB2HYu7g2xseAZ5MlN6Kz/qnkASV8U=',
            },
            {
              path: '/src/jquery.js',
              size: 978,
              type: 'text/javascript',
              integrity: 'sha256-TyqGpDScWhEDKuSRMWu9to6poNxOxXo9yRRqcmsCs6k=',
            },
            {
              path: '/dist/jquery.min.js',
              size: 78748,
              type: 'text/javascript',
              integrity: 'sha256-OaVG6prZf4v69dPg6PhVattBXkcOWQB62pdZ3ORyrao=',
            },
          ],
        });

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
        .reply(200, {
          package: '@popperjs/core',
          version: '2.11.8',
          prefix: '/',
          files: [
            {
              path: '/lib/index.js',
              size: 443,
              type: 'text/javascript',
              integrity: 'sha256-UqkAFbzZZwTVGU3Es2nAXtH0+jto8SgHJmKdKajwaFE=',
            },
            {
              path: '/dist/umd/popper.js.map',
              size: 142165,
              type: 'application/json',
              integrity: 'sha256-gxTC44s+8qqYoCO/rXH5jSsp2lLnnJY/b4ddTqElNHA=',
            },
            {
              path: '/dist/umd/popper.min.js',
              size: 20122,
              type: 'text/javascript',
              integrity: 'sha256-whL0tQWoY1Ku1iskqPFvmZ+CHsvmRWx/PIoEvIeWh4I=',
            },
            {
              path: '/dist/umd/popper.min.js.flow',
              size: 46,
              type: 'text/plain',
              integrity: 'sha256-b/2A0ou/wX++eSKbp3tyP/MHkltx/rRhxxv412BX9Wc=',
            },
          ],
        });

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
