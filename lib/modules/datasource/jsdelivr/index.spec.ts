import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { getDigest, getPkgReleases } from '../index.ts';
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

    it('processes real npm data (scoped)', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('npm/@popperjs/core'))
        .reply(200, Fixtures.get('npm_scoped_popperjs_core.json'));
      const res = await getPkgReleases({
        datasource: JsDelivrDatasource.id,
        packageName: 'npm/@popperjs/core',
      });
      expect(res?.tags).toBeNonEmptyObject();
      expect(res?.tags?.latest).toBe('2.11.8');
      expect(res?.tags?.beta).toBeUndefined();

      expect(res?.releases).toHaveLength(3);
      expect(res?.releases[res?.releases.length - 1].version).toBe('2.11.8');

      expect(res?.registryUrl).toBe(baseUrl);
    });

    it('processes real npm data (unscoped)', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('npm/jquery'))
        .reply(200, Fixtures.get('npm_unscoped_jquery.json'));
      const res = await getPkgReleases({
        datasource: JsDelivrDatasource.id,
        packageName: 'npm/jquery',
      });
      expect(res?.tags).toBeNonEmptyObject();
      expect(res?.tags?.latest).toBe('4.0.0');
      expect(res?.tags?.beta).toBe('4.0.0-rc.2');

      expect(res?.releases).toHaveLength(6);
      expect(res?.releases[res?.releases.length - 1].version).toBe(
        '4.0.0-beta',
      );

      expect(res?.registryUrl).toBe(baseUrl);
    });
  });

  describe('getDigest', () => {
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
