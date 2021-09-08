import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
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
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mock('../../logger');
  });

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

    it('parses real data (merge strategy with 2 registries)', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, loadFixture('releases-as-files.html'));
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, '<html>\n<h1>Header</h1>\n<a>1.3.0</a>\n<hmtl/>');
      const res = await getPkgReleases({
        registryUrls: [testRegistryUrl, testRegistryUrl],
        depName: testLookupName,
        datasource,
        lookupName: testLookupName,
      });
      expect(res.releases).toHaveLength(5);
      expect(res).toMatchSnapshot();
    });

    it('returns null without registryUrl + warning', async () => {
      const res = await getPkgReleases({
        datasource,
        depName: testLookupName,
        lookupName: testLookupName,
      });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'artifactory datasource requires custom registryUrl. Skipping datasource'
      );
      expect(res).toBeNull();
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

    it('404 returns null', async () => {
      httpMock.scope(testRegistryUrl).get(getPath(testLookupName)).reply(404);
      expect(
        await getPkgReleases({
          ...testConfig,
          datasource,
          lookupName: testLookupName,
        })
      ).toBeNull();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'artifactory: "Not Found" error for project under https://jfrog.company.com/artifactory/project'
      );
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

    it('throws no Http error', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .replyWithError('unknown error');
      const res = await getPkgReleases({
        ...testConfig,
        datasource,
        lookupName: testLookupName,
      });
      expect(res).toBeNull();
      expect(res).toMatchSnapshot();
    });
  });
});
