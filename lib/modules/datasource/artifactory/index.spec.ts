import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { joinUrlParts } from '../../../util/url';
import { ArtifactoryDatasource } from '.';

const datasource = ArtifactoryDatasource.id;

const testRegistryUrl = 'https://jfrog.company.com/artifactory';
const testLookupName = 'project';
const testConfig = {
  registryUrls: [testRegistryUrl],
  packageName: testLookupName,
};
const fixtureReleasesAsFolders = Fixtures.get('releases-as-folders.html');
const fixtureReleasesAsFiles = Fixtures.get('releases-as-files.html');

function getPath(folder: string): string {
  return `/${folder}`;
}

describe('modules/datasource/artifactory/index', () => {
  describe('getReleases', () => {
    it('parses real data (folders): with slash at the end', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, fixtureReleasesAsFolders);
      const res = await getPkgReleases({
        ...testConfig,
        datasource,
        packageName: testLookupName,
      });
      expect(res?.releases).toHaveLength(4);
      expect(res).toMatchSnapshot({
        registryUrl: 'https://jfrog.company.com/artifactory',
      });
    });

    it('parses real data (files): without slash at the end', async () => {
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, fixtureReleasesAsFiles);
      const res = await getPkgReleases({
        ...testConfig,
        datasource,
        packageName: testLookupName,
      });
      expect(res?.releases).toHaveLength(4);
      expect(res).toMatchSnapshot({
        registryUrl: 'https://jfrog.company.com/artifactory',
      });
    });

    it('parses real data (merge strategy with 2 registries)', async () => {
      const secondRegistryUrl: string = joinUrlParts(
        testRegistryUrl,
        'production',
      );
      httpMock
        .scope(testRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, fixtureReleasesAsFiles);
      httpMock
        .scope(secondRegistryUrl)
        .get(getPath(testLookupName))
        .reply(200, '<html>\n<h1>Header</h1>\n<a>1.3.0</a>\n<hmtl/>');
      const res = await getPkgReleases({
        registryUrls: [testRegistryUrl, secondRegistryUrl],
        datasource,
        packageName: testLookupName,
      });
      expect(res?.releases).toHaveLength(5);
      expect(res).toMatchSnapshot();
    });

    it('returns null without registryUrl + warning', async () => {
      const res = await getPkgReleases({
        datasource,
        packageName: testLookupName,
      });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        { packageName: 'project' },
        'artifactory datasource requires custom registryUrl. Skipping datasource',
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
          packageName: testLookupName,
        }),
      ).toBeNull();
    });

    it('404 returns null', async () => {
      httpMock.scope(testRegistryUrl).get(getPath(testLookupName)).reply(404);
      expect(
        await getPkgReleases({
          ...testConfig,
          datasource,
          packageName: testLookupName,
        }),
      ).toBeNull();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        {
          packageName: 'project',
          registryUrl: 'https://jfrog.company.com/artifactory',
        },
        'artifactory: `Not Found` error',
      );
    });

    it('throws for error diff than 404', async () => {
      httpMock.scope(testRegistryUrl).get(getPath(testLookupName)).reply(502);
      await expect(
        getPkgReleases({
          ...testConfig,
          datasource,
          packageName: testLookupName,
        }),
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
        packageName: testLookupName,
      });
      expect(res).toBeNull();
    });
  });
});
