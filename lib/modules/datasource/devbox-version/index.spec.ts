import { getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { DevboxVersionDatasource } from '.';
import * as httpMock from '~test/http-mock';

const datasource = DevboxVersionDatasource.id;
const baseUrl = 'https://releases.jetify.com';
const registryUrl = `${baseUrl}/devbox/stable/`;
const apiPath = '/devbox/stable/version';

describe('modules/datasource/devbox-version/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get(apiPath).reply(200, '');
      const res = await getPkgReleases({
        datasource,
        packageName: 'devbox',
        registryUrls: [registryUrl],
      });
      expect(res).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(apiPath).reply(404);
      const res = await getPkgReleases({
        datasource,
        packageName: 'devbox',
        registryUrls: [registryUrl],
      });
      expect(res).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(apiPath).reply(502);
      const res = getPkgReleases({
        datasource,
        packageName: 'devbox',
        registryUrls: [registryUrl],
      });
      await expect(res).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for invalid version', async () => {
      httpMock.scope(baseUrl).get(apiPath).reply(200, 'invalid-version-string');
      const res = await getPkgReleases({
        datasource,
        packageName: 'devbox',
        registryUrls: [registryUrl],
      });
      expect(res).toBeNull();
    });

    it('processes real data', async () => {
      httpMock.scope(baseUrl).get(apiPath).reply(200, '0.16.0');
      const res = await getPkgReleases({
        datasource,
        packageName: 'devbox',
        registryUrls: [registryUrl],
      });
      expect(res).toEqual({
        homepage: 'https://www.jetify.com/devbox',
        sourceUrl: 'https://github.com/jetify-com/devbox',
        registryUrl,
        releases: [{ version: '0.16.0' }],
      });
    });

    it('processes data with whitespace', async () => {
      httpMock.scope(baseUrl).get(apiPath).reply(200, '  0.16.0  \n');
      const res = await getPkgReleases({
        datasource,
        packageName: 'devbox',
        registryUrls: [registryUrl],
      });
      expect(res).toEqual({
        homepage: 'https://www.jetify.com/devbox',
        sourceUrl: 'https://github.com/jetify-com/devbox',
        registryUrl,
        releases: [{ version: '0.16.0' }],
      });
    });
  });
});
