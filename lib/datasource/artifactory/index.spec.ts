import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { ArtifactoryDatasource } from '.';

const artifactoryReleasesHtml = loadFixture('releases.html');

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
    it('parses real data', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, artifactoryReleasesHtml);
      const res = await getPkgReleases({
        ...testConfig,
        datasource,
        lookupName: testLookupName,
      });
      expect(res.releases).toHaveLength(4);
      expect(res).toMatchSnapshot();
    });

    it('parses real data: without slash at the end', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, loadFixture('releases-wo-slash.html'));
      const res = await getPkgReleases({
        ...testConfig,
        datasource,
        lookupName: testLookupName,
      });
      expect(res.releases).toHaveLength(4);
      expect(res).toMatchSnapshot();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(testRegistryUrl).get(getPath(testLookupName)).reply(502);
      await expect(
        getPkgReleases({
          ...testConfig,
          datasource,
          lookupName: testLookupName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
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

    it('throws for error', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .replyWithError('error in unit tests');
      await expect(
        getPkgReleases({
          ...testConfig,
          datasource,
          lookupName: testLookupName,
        })
      ).rejects.toThrow();
    });
  });
});
