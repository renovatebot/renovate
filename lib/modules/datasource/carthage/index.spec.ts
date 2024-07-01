import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { CarthageDatasource } from '.';

const baseUrl = 'http://some-package-registry.com';
const urlPath = '/Package.json';
const registryUrl = `${baseUrl}${urlPath}`;

describe('modules/datasource/carthage/index', () => {
  const carthage = new CarthageDatasource();

  describe('getReleases', () => {
    it('throws for 404', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(404);
      await expect(
        carthage.getReleases({
          packageName: 'Package',
          registryUrl,
        })
      ).rejects.toThrow('Response code 404 (Not Found)');
    });

    it('throws for 429', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(429);
      await expect(
        carthage.getReleases({
          packageName: 'Package',
          registryUrl,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(502);
      await expect(
        carthage.getReleases({
          packageName: 'Package',
          registryUrl,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes empty data', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(200, {});
      const res = await carthage.getReleases({
        packageName: 'Package',
        registryUrl,
      });
      expect(res).toBeNull();
    });

    it('processes real data', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(200, {
        '8.10.0': 'some.zip',
        '8.11.0': 'some.zip',
        '8.12.1': 'some.zip',
        '8.13.0': 'some.zip',
        '8.14.0': 'some.zip',
        '8.15.0': 'some.zip',
      });
      const res = await carthage.getReleases({
        packageName: 'Package',
        registryUrl,
      });
      expect(res).toEqual({
        registryUrl,
        releases: [
          {
            version: '8.10.0',
          },
          {
            version: '8.11.0',
          },
          {
            version: '8.12.1',
          },
          {
            version: '8.13.0',
          },
          {
            version: '8.14.0',
          },
          {
            version: '8.15.0',
          },
        ],
      });
    });
  });
});
