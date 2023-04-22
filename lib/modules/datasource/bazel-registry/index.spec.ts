import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { BazelRegistryDatasource } from '.';

const datasource = BazelRegistryDatasource.id;
const defaultRegistryUrl = BazelRegistryDatasource.bazelCentralRepoUrl;
const packageName = 'rules_foo';
const path = BazelRegistryDatasource.packageMetadataPath(packageName);

describe('modules/datasource/bazel-registry/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        })
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        })
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).reply(200, { versions: [] });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('metadata without yanked versions', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-no-yanked-versions.json'));
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(4);
    });

    it('metadata with yanked versions', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-with-yanked-versions.json'));
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(3);
    });
  });
});
