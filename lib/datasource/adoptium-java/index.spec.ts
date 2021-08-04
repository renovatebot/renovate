import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { datasource, defaultRegistryUrl, pageSize } from './common';

const res1 = loadFixture('page.json');

function getPath(page: number): string {
  return `/v3/release_versions?page_size=${pageSize}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC&vendor=adoptium&page=${page}`;
}
function* range(start: number, end: number): Generator<number, number, number> {
  yield start;
  if (start === end) {
    return;
  }
  yield* range(start + 1, end);
}

describe(getName(), () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          depName: 'adoptium-java',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'adoptium-java',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .reply(200, { versions: [] });
      expect(
        await getPkgReleases({
          datasource,
          depName: 'adoptium-java',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          depName: 'adoptium-java',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('processes real data', async () => {
      httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName: 'adoptium-java',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('pages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(getPath(0))
        .reply(200, {
          versions: [...range(1, 50)].map((v) => ({ semver: `1.${v}.0` })),
        })
        .get(getPath(1))
        .reply(404);
      const res = await getPkgReleases({
        datasource,
        depName: 'adoptium-java',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(50);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
