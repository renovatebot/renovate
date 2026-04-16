import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { BazelDatasource } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const datasource = BazelDatasource.id;
const defaultRegistryUrl = BazelDatasource.bazelCentralRepoUrl;
const bcrUiBaseUrl = BazelDatasource.bcrUiBaseUrl;
const packageName = 'rules_foo';
const path = BazelDatasource.packageMetadataPath(packageName);
const bcrUiPath = `/modules/${packageName}`;

const mockMetadata = {
  versions: ['0.14.8', '0.14.9', '0.15.0', '0.16.0'],
  yanked_versions: {
    '0.15.0': 'yanked for security reasons',
  },
  homepage: 'https://github.com/foo/bar',
};

function bcrPageHtml(json: string): string {
  return `<!DOCTYPE html><html><head></head><body><script id="__NEXT_DATA__" type="application/json">${json}</script></body></html>`;
}

const bcrPageData = {
  props: {
    pageProps: {
      versionInfos: [
        {
          version: '0.14.8',
          submission: { status: ['A'], authorDateIso: '2024-01-10T12:00:00Z' },
        },
        {
          version: '0.14.9',
          submission: { status: ['A'], authorDateIso: '2024-03-15T14:30:00Z' },
        },
        {
          version: '0.15.0',
          submission: { status: ['A'], authorDateIso: '2024-06-20T09:00:00Z' },
        },
        {
          version: '0.16.0',
          submission: { status: ['A'], authorDateIso: '2024-09-01T16:45:00Z' },
        },
      ],
    },
  },
};
const mockBcrPage = bcrPageHtml(JSON.stringify(bcrPageData));

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
      httpMock.scope(bcrUiBaseUrl).get(bcrUiPath).reply(200, mockBcrPage);
      const res = await getPkgReleases({ datasource, packageName });
      expect(res).toEqual({
        registryUrl:
          'https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main',
        releases: [
          {
            version: '0.14.8',
            releaseTimestamp: '2024-01-10T12:00:00.000Z',
          },
          {
            version: '0.14.9',
            releaseTimestamp: '2024-03-15T14:30:00.000Z',
          },
          {
            version: '0.15.0',
            releaseTimestamp: '2024-06-20T09:00:00.000Z',
          },
          {
            version: '0.16.0',
            releaseTimestamp: '2024-09-01T16:45:00.000Z',
          },
        ],
        sourceUrl: 'https://github.com/foo/bar',
      });
    });

    it('marks yanked versions as deprecated', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-with-yanked-versions.json'));
      httpMock.scope(bcrUiBaseUrl).get(bcrUiPath).reply(200, mockBcrPage);
      const res = await getPkgReleases({ datasource, packageName });
      expect(res?.releases).toMatchObject([
        { version: '0.14.8' },
        { version: '0.14.9' },
        { version: '0.15.0', isDeprecated: true },
        { version: '0.16.0' },
      ]);
    });

    it('returns releases without timestamps when BCR UI page fetch fails', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-no-yanked-versions.json'));
      httpMock.scope(bcrUiBaseUrl).get(bcrUiPath).reply(500);
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

    it('returns releases without timestamps when BCR UI page has no __NEXT_DATA__', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-no-yanked-versions.json'));
      httpMock
        .scope(bcrUiBaseUrl)
        .get(bcrUiPath)
        .reply(200, '<html><body>no data</body></html>');
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

    it('fetches BCR UI timestamps for custom registry URLs (BCR mirrors)', async () => {
      const customRegistryUrl = 'https://custom-registry.example.com';
      httpMock
        .scope(customRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-no-yanked-versions.json'));
      httpMock.scope(bcrUiBaseUrl).get(bcrUiPath).reply(200, mockBcrPage);
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [customRegistryUrl],
      });
      expect(res).toEqual({
        registryUrl: customRegistryUrl,
        releases: [
          {
            version: '0.14.8',
            releaseTimestamp: '2024-01-10T12:00:00.000Z',
          },
          {
            version: '0.14.9',
            releaseTimestamp: '2024-03-15T14:30:00.000Z',
          },
          {
            version: '0.15.0',
            releaseTimestamp: '2024-06-20T09:00:00.000Z',
          },
          {
            version: '0.16.0',
            releaseTimestamp: '2024-09-01T16:45:00.000Z',
          },
        ],
        sourceUrl: 'https://github.com/foo/bar',
      });
    });

    it('gracefully handles BCR UI failure for custom registry URLs', async () => {
      const customRegistryUrl = 'https://custom-registry.example.com';
      httpMock
        .scope(customRegistryUrl)
        .get(path)
        .reply(200, Fixtures.get('metadata-no-yanked-versions.json'));
      httpMock.scope(bcrUiBaseUrl).get(bcrUiPath).reply(404);
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [customRegistryUrl],
      });
      expect(res).toEqual({
        registryUrl: customRegistryUrl,
        releases: [
          { version: '0.14.8' },
          { version: '0.14.9' },
          { version: '0.15.0' },
          { version: '0.16.0' },
        ],
        sourceUrl: 'https://github.com/foo/bar',
      });
    });
  });

  describe('local file handling', () => {
    const mockFilePath = `/tmp/mock-registry/modules/${packageName}/metadata.json`;
    const localRegistryUrl = `file:///tmp/mock-registry`;

    beforeEach(() => {
      GlobalConfig.set({
        localDir: '/tmp/mock-registry',
      });
    });

    it('should handle local file correctly', async () => {
      vi.mocked(fs.readLocalFile).mockImplementation((file: string) => {
        if (file === mockFilePath) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        return Promise.resolve(null);
      });

      vi.mocked(fs.isValidLocalPath).mockImplementation((file: string) => {
        return file === mockFilePath;
      });

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
        sourceUrl: 'https://github.com/foo/bar',
      });
    });

    it('should return null for invalid file path', async () => {
      vi.mocked(fs.isValidLocalPath).mockImplementation(() => false);

      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [localRegistryUrl],
      });
      expect(res).toBeNull();
    });

    it('should return null for empty file content', async () => {
      vi.mocked(fs.readLocalFile).mockImplementation((file: string) => {
        if (file === mockFilePath) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      vi.mocked(fs.isValidLocalPath).mockImplementation((file: string) => {
        return file === mockFilePath;
      });

      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [localRegistryUrl],
      });
      expect(res).toBeNull();
    });
  });
});
