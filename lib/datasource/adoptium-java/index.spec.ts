import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { datasource, defaultRegistryUrl, pageSize } from './common';

const res1 = loadFixture('page.json');
const jre = loadFixture('jre.json');

function getPath(page: number, imageType = 'jdk'): string {
  return `/v3/info/release_versions?page_size=${pageSize}&image_type=${imageType}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC&vendor=adoptium&page=${page}`;
}

function* range(
  start: number,
  end: number
): Generator<number, void, voud> {
  yield start;
  if (start === end) {
    return;
  }
  yield* range(start + 1, end);
}

const depName = 'java';

describe('datasource/adoptium-java/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          depName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
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
          depName,
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          depName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(3);
    });

    it('processes real data (jre)', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0, 'jre')).reply(200, jre);
      const res = await getPkgReleases({
        datasource,
        depName: 'java-jre',
      });
      expect(res).toMatchSnapshot();
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
        depName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(50);
    });
  });
});
