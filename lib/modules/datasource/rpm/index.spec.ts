import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { codeBlock } from 'common-tags';
import type { DirectoryResult } from 'tmp-promise';
import { dir as tmpDir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import * as cacheFs from '../../../util/fs/index.ts';
import { toSha256 } from '../../../util/hash.ts';
import { RpmDatasource } from './index.ts';

const registryUrl = 'https://example.com/repo/repodata/';
const primaryXmlUrl =
  'https://example.com/repo/repodata/somesha256-primary.xml.gz';
const primaryXmlRegistryUrl = primaryXmlUrl.replace(/\/[^/]+$/, '');

describe('modules/datasource/rpm/index', () => {
  let cacheDirResult: DirectoryResult | null;
  let rpmDatasource: RpmDatasource;

  beforeEach(async () => {
    rpmDatasource = new RpmDatasource();
    cacheDirResult = await tmpDir({ unsafeCleanup: true });

    GlobalConfig.reset();
    memCache.init();
    GlobalConfig.set({ cacheDir: cacheDirResult.path });
    await packageCache.init({ cacheDir: cacheDirResult.path });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await packageCache.cleanup({});
    memCache.reset();
    GlobalConfig.reset();
    await cacheDirResult?.cleanup();
    cacheDirResult = null;
  });

  describe('getPrimaryGzipUrl', () => {
    it('returns the correct primary.xml URL', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      const resolvedPrimaryXmlUrl =
        await rpmDatasource.getPrimaryGzipUrl(registryUrl);

      expect(resolvedPrimaryXmlUrl).toBe(primaryXmlUrl);
    });

    it('returns the correct primary.xml URL when repomd.xml omits xml declaration', async () => {
      const repomdXml = codeBlock`
        <repomd xmlns="http://linux.duke.edu/metadata/repo"
          xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      const resolvedPrimaryXmlUrl =
        await rpmDatasource.getPrimaryGzipUrl(registryUrl);

      expect(resolvedPrimaryXmlUrl).toBe(primaryXmlUrl);
    });

    it('throws an error if repomd.xml is missing', async () => {
      httpMock.scope(registryUrl).get('/repomd.xml').reply(404, 'Not Found');

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(
        `Request failed with status code 404 (Not Found): GET ${registryUrl}repomd.xml`,
      );
    });

    it('throws an error if http.getText fails', async () => {
      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .replyWithError('Network error');

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow('Network error');
    });

    it('throws an error if repomdXml is not in XML format', async () => {
      const repomdXml = codeBlock`
        <?invalidxml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(`is not in XML format.`);
    });

    it('throws an error if no primary data is found', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="non-primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(`No primary data found in ${registryUrl}repomd.xml`);
    });

    it('throws an error if no location element is found', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <non-location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(
        `No location element found in ${registryUrl}repomd.xml`,
      );
    });

    it('throws an error if location href is missing', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location non-href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(`No href found in ${registryUrl}repomd.xml`);
    });
  });

  describe('getReleasesByPackageName', () => {
    const packageName = 'example-package';
    const extractedPrimaryXmlPath = `others/rpm/${toSha256(primaryXmlUrl)}.xml`;

    function buildPrimaryXml(packageEntries: string): string {
      return codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <metadata xmlns="http://linux.duke.edu/metadata/common">
          ${packageEntries}
        </metadata>
      `;
    }

    function mockPrimaryXmlResponse(primaryXml: string): void {
      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .reply(200, gzipSync(primaryXml), {
          'Content-Type': 'application/gzip',
        });
    }

    it('returns the correct releases', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.1" rel="1.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.1" rel="2.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.2"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toEqual({
        releases: [
          { version: '1.0-2.azl3' },
          { version: '1.1-1.azl3' },
          { version: '1.1-2.azl3' },
          { version: '1.2' },
        ],
      });
    });

    it('throws an error if somesha256-primary.xml.gz is not found', async () => {
      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .reply(404, 'Not Found');

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toThrow(
        `Request failed with status code 404 (Not Found): GET ${primaryXmlUrl}`,
      );
    });

    it('throws an error if response.body is empty', async () => {
      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .reply(200, '', { 'Content-Type': 'application/gzip' });

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toThrow(`Empty response body from getting ${primaryXmlUrl}.`);
    });

    it('rethrows non-Error fetch failures', async () => {
      vi.spyOn(
        (
          rpmDatasource as unknown as {
            http: { stream: (url: string) => NodeJS.ReadableStream };
          }
        ).http,
        'stream',
      ).mockReturnValue(Readable.from([]));
      vi.spyOn(cacheFs, 'pipeline').mockRejectedValue('boom');

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toBe('boom');
    });

    it('reuses the extracted primary.xml file across package lookups', async () => {
      const primaryXml = buildPrimaryXml(codeBlock`
        <package type="rpm">
          <name>bash</name>
          <arch>x86_64</arch>
          <version epoch="0" ver="5.2.15" rel="1.azl3"/>
        </package>
        <package type="rpm">
          <name>curl</name>
          <arch>x86_64</arch>
          <version epoch="0" ver="8.5.0" rel="2.azl3"/>
        </package>
      `);

      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .once()
        .reply(200, gzipSync(primaryXml), {
          'Content-Type': 'application/gzip',
        });
      httpMock
        .scope(primaryXmlRegistryUrl)
        .head('/somesha256-primary.xml.gz')
        .once()
        .reply(304);

      const bashReleases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        'bash',
      );
      const curlReleases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        'curl',
      );

      expect(bashReleases).toEqual({
        releases: [{ version: '5.2.15-1.azl3' }],
      });
      expect(curlReleases).toEqual({
        releases: [{ version: '8.5.0-2.azl3' }],
      });
    });

    it('re-downloads primary.xml if the freshness check fails', async () => {
      const primaryXml = buildPrimaryXml(codeBlock`
        <package type="rpm">
          <name>bash</name>
          <arch>x86_64</arch>
          <version epoch="0" ver="5.2.15" rel="1.azl3"/>
        </package>
        <package type="rpm">
          <name>curl</name>
          <arch>x86_64</arch>
          <version epoch="0" ver="8.5.0" rel="2.azl3"/>
        </package>
      `);

      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .twice()
        .reply(200, gzipSync(primaryXml), {
          'Content-Type': 'application/gzip',
        });
      httpMock
        .scope(primaryXmlRegistryUrl)
        .head('/somesha256-primary.xml.gz')
        .once()
        .replyWithError('Unexpected Error');

      const bashReleases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        'bash',
      );
      const curlReleases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        'curl',
      );

      expect(bashReleases).toEqual({
        releases: [{ version: '5.2.15-1.azl3' }],
      });
      expect(curlReleases).toEqual({
        releases: [{ version: '8.5.0-2.azl3' }],
      });
    });

    it('throws if extracting primary.xml fails without an existing cache file', async () => {
      const originalPipeline = cacheFs.pipeline;

      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .reply(
          200,
          gzipSync(
            buildPrimaryXml(codeBlock`
              <package type="rpm">
                <name>example-package</name>
                <arch>x86_64</arch>
                <version epoch="0" ver="1.0" rel="2.azl3"/>
              </package>
            `),
          ),
          {
            'Content-Type': 'application/gzip',
          },
        );

      vi.spyOn(cacheFs, 'pipeline')
        .mockImplementationOnce(
          (...args: Parameters<typeof cacheFs.pipeline>) =>
            originalPipeline(...args),
        )
        .mockRejectedValueOnce('extract failed');

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toThrow('Missing metadata in extracted RPM metadata file!');
    });

    it('keeps the previous extracted primary.xml if a refresh extract fails', async () => {
      const originalPipeline = cacheFs.pipeline;

      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
        `),
      );

      expect(
        await rpmDatasource.getReleasesByPackageName(
          primaryXmlUrl,
          packageName,
        ),
      ).toEqual({
        releases: [{ version: '1.0-2.azl3' }],
      });

      httpMock
        .scope(primaryXmlRegistryUrl)
        .head('/somesha256-primary.xml.gz')
        .once()
        .reply(200);
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="2.0" rel="1.azl3"/>
          </package>
        `),
      );

      vi.spyOn(cacheFs, 'pipeline')
        .mockImplementationOnce(
          (...args: Parameters<typeof cacheFs.pipeline>) =>
            originalPipeline(...args),
        )
        .mockRejectedValueOnce(new Error('extract failed'));

      expect(
        await rpmDatasource.getReleasesByPackageName(
          primaryXmlUrl,
          packageName,
        ),
      ).toEqual({
        releases: [{ version: '1.0-2.azl3' }],
      });
      await expect(
        cacheFs.readCacheFile(extractedPrimaryXmlPath, 'utf8'),
      ).resolves.toContain('ver="1.0"');
    });

    it('replaces the extracted primary.xml after a successful refresh', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
        `),
      );

      expect(
        await rpmDatasource.getReleasesByPackageName(
          primaryXmlUrl,
          packageName,
        ),
      ).toEqual({
        releases: [{ version: '1.0-2.azl3' }],
      });

      httpMock
        .scope(primaryXmlRegistryUrl)
        .head('/somesha256-primary.xml.gz')
        .once()
        .reply(200);
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="2.0" rel="1.azl3"/>
          </package>
        `),
      );

      expect(
        await rpmDatasource.getReleasesByPackageName(
          primaryXmlUrl,
          packageName,
        ),
      ).toEqual({
        releases: [{ version: '2.0-1.azl3' }],
      });
      await expect(
        cacheFs.readCacheFile(extractedPrimaryXmlPath, 'utf8'),
      ).resolves.toContain('ver="2.0"');
    });

    it('returns null if no element package is found in primary.xml', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <nonpackage type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </nonpackage>
        `),
      );

      const result = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(result).toBeNull();
    });

    it('returns null if the specific packageName is not found in primary.xml', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>wrong-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
        `),
      );

      expect(
        await rpmDatasource.getReleasesByPackageName(
          primaryXmlUrl,
          packageName,
        ),
      ).toBeNull();
    });

    it('returns null if version is not found in a version element', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <non-version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toBeNull();
    });

    it('returns null if version element is missing the ver attribute', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" rel="2.azl3"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toBeNull();
    });

    it('returns an array of releases without duplicate versionWithRel', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="dulp.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="dulp.azl3"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toEqual({
        releases: [{ version: '1.0-dulp.azl3' }],
      });
    });

    it('handles parser error event in getReleasesByPackageName', async () => {
      mockPrimaryXmlResponse(codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <%$#metadata xmlns="http://linux.duke.edu/metadata/common">
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="dulp.azl3"/>
          </package>
        </metadata>
      `);

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toThrowError('Unencoded <');
    });
  });

  describe('getReleases', () => {
    it('returns null if registryUrl is not provided', async () => {
      const releases = await rpmDatasource.getReleases({
        registryUrl: undefined,
        packageName: 'example-package',
      });

      expect(releases).toBeNull();
    });

    it('returns null if packageName is not provided', async () => {
      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: '',
      });

      expect(releases).toBeNull();
    });

    it('returns the correct releases', async () => {
      vi.spyOn(rpmDatasource, 'getPrimaryGzipUrl').mockResolvedValue(
        primaryXmlUrl,
      );
      vi.spyOn(rpmDatasource, 'getReleasesByPackageName').mockResolvedValue({
        releases: [
          { version: '1.0-2.azl3' },
          { version: '1.1-1.azl3' },
          { version: '1.1-2.azl3' },
          { version: '1.2' },
        ],
      });

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toEqual({
        releases: [
          { version: '1.0-2.azl3' },
          { version: '1.1-1.azl3' },
          { version: '1.1-2.azl3' },
          { version: '1.2' },
        ],
      });
    });

    it('throws an error if getPrimaryGzipUrl fails', async () => {
      vi.spyOn(rpmDatasource, 'getPrimaryGzipUrl').mockRejectedValue(
        new Error('Something wrong'),
      );

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow('Something wrong');
    });

    it('throws an error if getReleasesByPackageName fails', async () => {
      vi.spyOn(rpmDatasource, 'getPrimaryGzipUrl').mockResolvedValue(
        primaryXmlUrl,
      );
      vi.spyOn(rpmDatasource, 'getReleasesByPackageName').mockRejectedValue(
        new Error('Something wrong'),
      );

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow('Something wrong');
    });
  });
});
