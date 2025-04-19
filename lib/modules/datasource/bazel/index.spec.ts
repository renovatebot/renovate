import { getPkgReleases } from '..';
import { GlobalConfig } from '../../../config/global';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { BazelDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

const datasource = BazelDatasource.id;
const defaultRegistryUrl = BazelDatasource.bazelCentralRepoUrl;
const packageName = 'rules_foo';
const path = BazelDatasource.packageMetadataPath(packageName);

describe('modules/datasource/bazel/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).replyWithError('error');
      await expect(getPkgReleases({ datasource, packageName })).rejects.toThrow(
        EXTERNAL_HOST_ERROR,
      );
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).reply(404);
      expect(await getPkgReleases({ datasource, packageName })).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).reply(200, {});
      expect(await getPkgReleases({ datasource, packageName })).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, '{ "versions": [], "yanked_versions": {} }');
      expect(await getPkgReleases({ datasource, packageName })).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(path).reply(502);
      await expect(getPkgReleases({ datasource, packageName })).rejects.toThrow(
        EXTERNAL_HOST_ERROR,
      );
    });

    it('metadata without yanked versions', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-no-yanked-versions.json'));
      const res = await getPkgReleases({ datasource, packageName });
      expect(res).toEqual({
        registryUrl:
          'https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main',
        releases: [
          { version: '0.14.8' },
          { version: '0.14.9' },
          { version: '0.15.0' },
          { version: '0.16.0' },
        ],
        sourceUrl: 'https://github.com/foo/bar',
      });
    });

    it('metadata with yanked versions', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-with-yanked-versions.json'));
      const res = await getPkgReleases({ datasource, packageName });
      expect(res).toEqual({
        registryUrl:
          'https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main',
        releases: [
          { version: '0.14.8' },
          { version: '0.14.9' },
          { version: '0.15.0', isDeprecated: true },
          { version: '0.16.0' },
        ],
      });
    });
  });

  describe('local file handling', () => {
    it('should handle local file correctly', async () => {
      const mockFs: Record<string, string> = {
        [`/tmp/mock-registry/modules/${packageName}/metadata.json`]:
          Fixtures.get('metadata-with-yanked-versions.json'),
      };
      fs.readLocalFile.mockImplementation(
        (file: string): Promise<string | null> => {
          if (file in mockFs) {
            return Promise.resolve(mockFs[file]);
          }
          return Promise.resolve(null);
        },
      );

      fs.isValidLocalPath.mockImplementation((file: string): boolean => {
        return file in mockFs;
      });

      GlobalConfig.set({
        localDir: '/tmp/mock-registry',
      });
      const localRegistryUrl = `file:///tmp/mock-registry`;
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [localRegistryUrl],
      });
      expect(res).toEqual({
        registryUrl: localRegistryUrl,
        releases: [
          { version: '0.14.8' },
          { version: '0.14.9' },
          { version: '0.15.0', isDeprecated: true },
          { version: '0.16.0' },
        ],
      });
    });
  });
});
