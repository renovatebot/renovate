import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { ArtifactoryDatasource } from '.';

const datasource = ArtifactoryDatasource.id;

const testRegistryUrl = 'https://jfrog.company.com/artifactory';
const testLookupName = 'project';
const testConfig = {
  registryUrls: [testRegistryUrl],
  depName: testLookupName,
};

function getPath(folder: string): string {
  return '/' + folder;
}

describe('datasource/artifactory/index', () => {
  describe('getReleases', () => {
    it('parses real data (folders): with slash at the end', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, loadFixture('releases-as-folders.html'));
      const res = await getPkgReleases({
        ...testConfig,
        datasource,
        lookupName: testLookupName,
      });
      expect(res.releases).toHaveLength(4);
      expect(res).toMatchSnapshot();
    });

    it('parses real data (files): without slash at the end', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, loadFixture('releases-as-files.html'));
      const res = await getPkgReleases({
        ...testConfig,
        datasource,
        lookupName: testLookupName,
      });
      expect(res.releases).toHaveLength(4);
      expect(res).toMatchSnapshot();
    });

    it('throws without registryUrl', async () => {
      await expect(
        getPkgReleases({
          datasource,
          depName: testLookupName,
          lookupName: testLookupName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, '<html>\n<h1>Header wo. nodes</h1>\n<hmtl/>');
      expect(
        await getPkgReleases({
          ...testConfig,
          datasource,
          lookupName: testLookupName,
        })
      ).toBeNull();
    });

    it('throws for error diff than 404', async () => {
      httpMock.scope(testRegistryUrl).get(getPath(testLookupName)).reply(502);
      await expect(
        getPkgReleases({
          ...testConfig,
          datasource,
          lookupName: testLookupName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 404', async () => {
      httpMock.scope(testRegistryUrl).get(getPath(testLookupName)).reply(404);
      expect(
        await getPkgReleases({
          ...testConfig,
          datasource,
          lookupName: testLookupName,
        })
      ).toBeNull();
    });
  });
});
