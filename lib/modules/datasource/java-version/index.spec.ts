import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { range } from '../../../util/range.ts';
import { getPkgReleases } from '../index.ts';
import { datasource, defaultRegistryUrl, pageSize } from './common.ts';

function getPath(page: number, imageType = 'jdk', args = ''): string {
  return `/v3/info/release_versions?page_size=${pageSize}&image_type=${imageType}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC${args}&page=${page}`;
}

const packageName = 'java';

describe('modules/datasource/java-version/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .reply(200, { versions: [] });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .reply(200, Fixtures.get('page.json'));
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toEqual({
        homepage: 'https://adoptium.net',
        registryUrl: 'https://api.adoptium.net/',
        releases: [
          {
            version: '8.0.302+8',
          },
          {
            version: '11.0.12+7',
          },
          {
            version: '16.0.2+7',
          },
        ],
      });
      expect(res?.releases).toHaveLength(3);
    });

    it('processes real data (jre)', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0, 'jre'))
        .reply(200, Fixtures.get('jre.json'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'java-jre',
      });
      expect(res).toEqual({
        homepage: 'https://adoptium.net',
        registryUrl: 'https://api.adoptium.net/',
        releases: [
          {
            version: '8.0.302+8',
          },
          {
            version: '11.0.12+7',
          },
        ],
      });
      expect(res?.releases).toHaveLength(2);
    });

    it('processes real data (jre,windows,x64)', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0, 'jre', '&os=windows&architecture=x64'))
        .reply(200, Fixtures.get('jre.json'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'java-jre?os=windows&architecture=x64',
      });
      expect(res?.releases).toHaveLength(2);
    });

    it('pages', async () => {
      const versions = [...range(1, 50)].map((v: number) => ({
        semver: `1.${v}.0`,
      }));
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .reply(200, { versions })
        .get(getPath(1))
        .reply(404);
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toEqual({
        homepage: 'https://adoptium.net',
        registryUrl: 'https://api.adoptium.net/',
        releases: [
          {
            version: '1.1.0',
          },
          {
            version: '1.2.0',
          },
          {
            version: '1.3.0',
          },
          {
            version: '1.4.0',
          },
          {
            version: '1.5.0',
          },
          {
            version: '1.6.0',
          },
          {
            version: '1.7.0',
          },
          {
            version: '1.8.0',
          },
          {
            version: '1.9.0',
          },
          {
            version: '1.10.0',
          },
          {
            version: '1.11.0',
          },
          {
            version: '1.12.0',
          },
          {
            version: '1.13.0',
          },
          {
            version: '1.14.0',
          },
          {
            version: '1.15.0',
          },
          {
            version: '1.16.0',
          },
          {
            version: '1.17.0',
          },
          {
            version: '1.18.0',
          },
          {
            version: '1.19.0',
          },
          {
            version: '1.20.0',
          },
          {
            version: '1.21.0',
          },
          {
            version: '1.22.0',
          },
          {
            version: '1.23.0',
          },
          {
            version: '1.24.0',
          },
          {
            version: '1.25.0',
          },
          {
            version: '1.26.0',
          },
          {
            version: '1.27.0',
          },
          {
            version: '1.28.0',
          },
          {
            version: '1.29.0',
          },
          {
            version: '1.30.0',
          },
          {
            version: '1.31.0',
          },
          {
            version: '1.32.0',
          },
          {
            version: '1.33.0',
          },
          {
            version: '1.34.0',
          },
          {
            version: '1.35.0',
          },
          {
            version: '1.36.0',
          },
          {
            version: '1.37.0',
          },
          {
            version: '1.38.0',
          },
          {
            version: '1.39.0',
          },
          {
            version: '1.40.0',
          },
          {
            version: '1.41.0',
          },
          {
            version: '1.42.0',
          },
          {
            version: '1.43.0',
          },
          {
            version: '1.44.0',
          },
          {
            version: '1.45.0',
          },
          {
            version: '1.46.0',
          },
          {
            version: '1.47.0',
          },
          {
            version: '1.48.0',
          },
          {
            version: '1.49.0',
          },
          {
            version: '1.50.0',
          },
        ],
      });
      expect(res?.releases).toHaveLength(50);
    });

    it('processes real data (jre,system)', async () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValueOnce('ia32');
      vi.spyOn(process, 'platform', 'get').mockReturnValueOnce('win32');
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0, 'jre', '&os=windows&architecture=x86'))
        .reply(200, Fixtures.get('jre.json'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'java-jre?system=true',
      });
      expect(res?.releases).toHaveLength(2);
    });
  });
});
