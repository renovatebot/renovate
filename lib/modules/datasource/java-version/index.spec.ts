import { getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { range } from '../../../util/range';
import { datasource, defaultRegistryUrl, pageSize } from './common';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
