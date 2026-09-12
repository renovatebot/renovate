import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { HttpError } from '../../../util/http/index.ts';
import { getDigest, getPkgReleases } from '../index.ts';
import { NpmDatasource } from '../npm/index.ts';
import { parseJsDelivrPackageName } from './common.ts';
import { JsDelivrDatasource } from './index.ts';

const baseUrl = 'https://data.jsdelivr.com/v1/';

function pathFor(packageName: string): string {
  const { type, package: depName } = parseJsDelivrPackageName(packageName);
  return `/packages/${type}/${depName}`;
}

function pathForDigest(packageName: string, version: string): string {
  const { type, package: parsedPackageName } =
    parseJsDelivrPackageName(packageName);
  return `/packages/${type}/${parsedPackageName}@${version}?structure=flat`;
}

describe('modules/datasource/jsdelivr/index', () => {
  describe('getReleases', () => {
    it('throws for empty result', async () => {
      httpMock.scope(baseUrl).get(pathFor('gh/foo/bar')).reply(200, '}');
      await expect(
        getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for error', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('gh/foo/bar'))
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(pathFor('gh/foo/bar')).reply(404);
      expect(
        await getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/foo/bar',
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('gh/doesnotexist/doesnotexist'))
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/doesnotexist/doesnotexist',
        }),
      ).toBeNull();
    });

    it('throws for 401', async () => {
      httpMock.scope(baseUrl).get(pathFor('gh/foo/bar')).reply(401);
      await expect(
        getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 429', async () => {
      httpMock.scope(baseUrl).get(pathFor('gh/foo/bar')).reply(429);
      await expect(
        getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(pathFor('gh/foo/bar')).reply(502);
      await expect(
        getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('gh/foo/bar'))
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real gh data', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('gh/twbs/bootstrap'))
        .reply(200, Fixtures.get('gh_bootstrap.json'));
      const res = await getPkgReleases({
        datasource: JsDelivrDatasource.id,
        packageName: 'gh/twbs/bootstrap/dist/js/bootstrap.min.js',
      });
      expect(res?.tags).toBeEmptyObject();

      expect(res?.releases).toHaveLength(4);
      expect(res?.releases[res?.releases.length - 1].version).toBe('5.3.8');

      expect(res?.registryUrl).toBe(baseUrl);
    });

    it('delegates npm-type packages to NpmDatasource (scoped)', async () => {
      const releaseResult = {
        releases: [{ version: '2.11.8' }],
      };
      const getReleasesSpy = vi
        .spyOn(NpmDatasource.prototype, 'getReleases')
        .mockResolvedValueOnce(releaseResult);

      const res = await getPkgReleases({
        datasource: JsDelivrDatasource.id,
        packageName: 'npm/@popperjs/core',
      });

      expect(res).toEqual(releaseResult);
      expect(getReleasesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ packageName: '@popperjs/core' }),
      );
    });

    it('delegates npm-type packages to NpmDatasource (unscoped)', async () => {
      const releaseResult = {
        releases: [{ version: '4.0.0' }],
      };
      const getReleasesSpy = vi
        .spyOn(NpmDatasource.prototype, 'getReleases')
        .mockResolvedValueOnce(releaseResult);

      const res = await getPkgReleases({
        datasource: JsDelivrDatasource.id,
        packageName: 'npm/jquery',
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
          datasource: JsDelivrDatasource.id,
          packageName: 'npm/does-not-exist',
        }),
      ).toBeNull();
    });
  });

  describe('getDigest', () => {
    it('returs null for no result', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('npm/foo/bar', '1.2.0'))
        .reply(200, '{}');

      const res = await getDigest(
        {
          datasource: JsDelivrDatasource.id,
          packageName: 'npm/foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returs null for empty "files" array', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('npm/foo/bar', '1.2.0'))
        .reply(200, JSON.stringify({ files: [] }));

      const res = await getDigest(
        {
          datasource: JsDelivrDatasource.id,
          packageName: 'npm/foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returs null if file not found', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('npm/foo/bar', '1.2.0'))
        .reply(
          200,
          JSON.stringify({ files: [{ name: 'not-real', string: 'hash' }] }),
        );

      const res = await getDigest(
        {
          datasource: JsDelivrDatasource.id,
          packageName: 'npm/foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('npm/foo/bar', '1.2.0'))
        .reply(404);
      await expect(
        getDigest(
          {
            datasource: JsDelivrDatasource.id,
            packageName: 'npm/foo/bar',
          },
          '1.2.0',
        ),
      ).rejects.toThrow(HttpError);
    });

    it('returns digest for scoped npm packages', async () => {
      httpMock
        .scope(baseUrl)
        .get(
          pathForDigest(
            'npm/@popperjs/core@2.11.8/dist/umd/popper.min.js',
            '2.11.8',
          ),
        )
        .reply(200, Fixtures.get('npm_scoped_popperjs_core_digest.json'));

      const res = await getDigest(
        {
          datasource: JsDelivrDatasource.id,
          packageName: 'npm/@popperjs/core/dist/umd/popper.min.js',
        },
        '2.11.8',
      );
      expect(res).toBe('sha256-whL0tQWoY1Ku1iskqPFvmZ+CHsvmRWx/PIoEvIeWh4I=');
    });

    it('returns digest for unscoped npm packages', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('npm/jquery/dist/jquery.min.js', '4.0.0'))
        .reply(200, Fixtures.get('npm_unscoped_jquery_digest.json'));

      const res = await getDigest(
        {
          datasource: JsDelivrDatasource.id,
          packageName: 'npm/jquery@4.0.0/dist/jquery.min.js',
        },
        '4.0.0',
      );
      expect(res).toBe('sha256-OaVG6prZf4v69dPg6PhVattBXkcOWQB62pdZ3ORyrao=');
    });

    it('returns digest for gh packages', async () => {
      httpMock
        .scope(baseUrl)
        .get(
          pathForDigest('gh/twbs/bootstrap/dist/js/bootstrap.min.js', '5.3.8'),
        )
        .reply(200, Fixtures.get('gh_bootstrap_digest.json'));

      const res = await getDigest(
        {
          datasource: JsDelivrDatasource.id,
          packageName: 'gh/twbs/bootstrap@5.3.8/dist/js/bootstrap.min.js',
        },
        '5.3.8',
      );
      expect(res).toBe('sha256-ew8UiV1pJH/YjpOEBInP1HxVvT/SfrCmwSoUzF9JIgc=');
    });
  });
});
