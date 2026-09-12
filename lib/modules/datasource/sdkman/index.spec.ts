import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { SdkmanDatasource } from './index.ts';

const packageName = 'java';
const datasource = SdkmanDatasource.id;

const registryUrlBase = 'https://api.sdkman.io/2/candidates';

function getPath() {
  return '/java/linuxx64/versions/all';
}

describe('modules/datasource/sdkman/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock.scope(registryUrlBase).get(getPath()).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(registryUrlBase).get(getPath()).reply(404);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(registryUrlBase).get(getPath()).reply(200, '');
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).resolves.toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(registryUrlBase).get(getPath()).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processRealData', async () => {
      httpMock
        .scope(`https://api.sdkman.io/2/candidates`)
        .get('/java/linuxx64/versions/all')
        .reply(200, Fixtures.get('java.csv'));

      const res = await getPkgReleases({
        datasource: SdkmanDatasource.id,
        packageName,
      });

      expect(res).toMatchObject({
        releases: [
          {
            version: '11.0.14.1-jbr',
          },
          {
            version: '11.0.30-sapmchn',
          },
          {
            version: '11.0.32-sem',
          },
          {
            version: '11.0.32-kona',
          },
          {
            version: '11.0.32-amzn',
          },
        ],
      });
    });

    describe('parsing of registry url', () => {
      const invalidUrl = 'https://api.sdkman.io/2/candidates';

      it('returns null when registry url is not a url', async () => {
        const res = await getPkgReleases({
          datasource: SdkmanDatasource.id,
          registryUrls: ['foobar'],
          packageName,
        });
        expect(res).toBeNull();
      });

      it('returns null when registry url misses binaryArch', async () => {
        const res = await getPkgReleases({
          datasource: SdkmanDatasource.id,
          registryUrls: [invalidUrl],
          packageName,
        });
        expect(res).toBeNull();
      });
    });
  });
});
