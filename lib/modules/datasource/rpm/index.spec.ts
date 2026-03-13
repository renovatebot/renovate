import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { codeBlock } from 'common-tags';
import type { DirectoryResult } from 'tmp-promise';
import { dir as tmpDir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import * as cacheFs from '../../../util/fs/index.ts';
import { RpmDatasource } from './index.ts';

vi.unmock('../../../util/mutex');

const registryUrl = 'https://example.com/repo/repodata/';
const primaryXmlUrl =
  'https://example.com/repo/repodata/somesha256-primary.xml.gz';
const primaryDbUrl =
  'https://example.com/repo/repodata/somesha256-primary.sqlite.gz';

function buildRepomdXml({
  primaryDbHref,
  primaryHref = 'repodata/somesha256-primary.xml.gz',
}: {
  primaryDbHref?: string;
  primaryHref?: string;
}): string {
  return codeBlock`
    <?xml version="1.0" encoding="UTF-8"?>
    <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
      ${
        primaryHref
          ? codeBlock`
              <data type="primary">
                <location href="${primaryHref}"/>
              </data>
            `
          : ''
      }
      ${
        primaryDbHref
          ? codeBlock`
              <data type="primary_db">
                <location href="${primaryDbHref}"/>
              </data>
            `
          : ''
      }
    </repomd>
  `;
}

function buildPrimaryXml(packageEntries: string): string {
  return codeBlock`
    <?xml version="1.0" encoding="UTF-8"?>
    <metadata xmlns="http://linux.duke.edu/metadata/common">
      ${packageEntries}
    </metadata>
  `;
}

async function createPrimaryDbGzip(
  rows: { name: string; release?: string | null; version: string | null }[],
): Promise<Buffer> {
  const dirResult = await tmpDir({ unsafeCleanup: true });
  const dbFile = `${dirResult.path}/primary.sqlite`;
  const db = new Database(dbFile);

  try {
    db.exec(`
      CREATE TABLE packages (
        name TEXT,
        version TEXT,
        release TEXT
      )
    `);

    const stmt = db.prepare(
      'INSERT INTO packages (name, version, release) VALUES (?, ?, ?)',
    );
    for (const row of rows) {
      stmt.run(row.name, row.version, row.release ?? null);
    }
  } finally {
    db.close();
  }

  try {
    const dbBuffer = await readFile(dbFile);
    return gzipSync(dbBuffer);
  } finally {
    await dirResult.cleanup();
  }
}

function mockRepomdResponse({
  primaryDbHref,
  primaryHref = 'repodata/somesha256-primary.xml.gz',
}: {
  primaryDbHref?: string;
  primaryHref?: string;
}): void {
  httpMock
    .scope(registryUrl)
    .get('/repomd.xml')
    .reply(200, buildRepomdXml({ primaryDbHref, primaryHref }), {
      'Content-Type': 'application/xml',
    });
}

function mockRawRepomdResponse(repomdXml: string): void {
  httpMock.scope(registryUrl).get('/repomd.xml').reply(200, repomdXml, {
    'Content-Type': 'application/xml',
  });
}

function mockPrimaryXmlResponse(primaryXml: string): void {
  httpMock
    .scope(primaryXmlUrl.replace(/\/[^/]+$/, ''))
    .get('/somesha256-primary.xml.gz')
    .reply(200, gzipSync(primaryXml), {
      'Content-Type': 'application/gzip',
    });
}

function mockPrimaryDbResponse(primaryDbGzip: Buffer): void {
  httpMock
    .scope(primaryDbUrl.replace(/\/[^/]+$/, ''))
    .get('/somesha256-primary.sqlite.gz')
    .reply(200, primaryDbGzip, {
      'Content-Type': 'application/gzip',
    });
}

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
      mockRepomdResponse({});

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

    it('throws an error if only primary_db data is found', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
        primaryHref: '',
      });

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

    it('ignores primary_db entries without a location element', async () => {
      mockRawRepomdResponse(codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
          <data type="primary_db">
            <non-location href="repodata/somesha256-primary.sqlite.gz"/>
          </data>
        </repomd>
      `);

      await expect(rpmDatasource.getPrimaryGzipUrl(registryUrl)).resolves.toBe(
        primaryXmlUrl,
      );
    });

    it('ignores primary_db entries without an href attribute', async () => {
      mockRawRepomdResponse(codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
          <data type="primary_db">
            <location non-href="repodata/somesha256-primary.sqlite.gz"/>
          </data>
        </repomd>
      `);

      await expect(rpmDatasource.getPrimaryGzipUrl(registryUrl)).resolves.toBe(
        primaryXmlUrl,
      );
    });
  });

  describe('getReleasesByPackageName', () => {
    const packageName = 'example-package';

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
        .scope(primaryXmlUrl.replace(/\/[^/]+$/, ''))
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
        .scope(primaryXmlUrl.replace(/\/[^/]+$/, ''))
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
            http: { getBuffer: (url: string) => unknown };
          }
        ).http,
        'getBuffer',
      ).mockRejectedValue('boom');

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toBe('boom');
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

    it('returns null if repository metadata resolution yields no usable sources', async () => {
      vi.spyOn(
        rpmDatasource as unknown as {
          getRepositoryMetadata: (registryUrl: string) => Promise<{
            repomdUrl: string;
          }>;
        },
        'getRepositoryMetadata',
      ).mockResolvedValue({
        repomdUrl: `${registryUrl}repomd.xml`,
      });

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toBeNull();
    });

    it('prefers primary_db when repomd.xml exposes both metadata formats', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
      });
      mockPrimaryDbResponse(
        await createPrimaryDbGzip([
          {
            name: 'example-package',
            release: '2.azl3',
            version: '1.0',
          },
          {
            name: 'example-package',
            release: '2.azl3',
            version: '1.0',
          },
          {
            name: 'example-package',
            version: '1.2',
          },
          {
            name: 'another-package',
            release: '1.azl3',
            version: '9.9',
          },
        ]),
      );

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toEqual({
        releases: [{ version: '1.0-2.azl3' }, { version: '1.2' }],
      });
    });

    it('uses separate cache entries for auto and forced primary metadata lookups', async () => {
      const repomdScope = httpMock.scope(registryUrl);
      repomdScope
        .get('/repomd.xml')
        .once()
        .reply(
          200,
          buildRepomdXml({
            primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
          }),
          { 'Content-Type': 'application/xml' },
        );
      mockPrimaryDbResponse(
        await createPrimaryDbGzip([
          {
            name: 'example-package',
            release: '2.azl3',
            version: '1.0',
          },
        ]),
      );
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="9.9" rel="1.azl3"/>
          </package>
        `),
      );

      const autoReleases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });
      const xmlReleases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
        rpmMetadataSource: 'primary',
      });

      expect(autoReleases).toEqual({
        releases: [{ version: '1.0-2.azl3' }],
      });
      expect(xmlReleases).toEqual({
        releases: [{ version: '9.9-1.azl3' }],
      });
    });

    it('does not fall back to primary.xml.gz when primary_db has no matching package', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
      });
      mockPrimaryDbResponse(
        await createPrimaryDbGzip([
          {
            name: 'another-package',
            release: '2.azl3',
            version: '1.0',
          },
        ]),
      );

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toBeNull();
    });

    it('does not fall back to primary.xml.gz when rpmMetadataSource is primary_db', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
      });
      mockPrimaryDbResponse(gzipSync('not-a-sqlite-database'));

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
          rpmMetadataSource: 'primary_db',
        }),
      ).rejects.toThrow();
    });

    it('throws sqlite errors when only primary_db metadata is present in auto mode', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
        primaryHref: '',
      });
      mockPrimaryDbResponse(gzipSync('not-a-sqlite-database'));

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow();
    });

    it('throws when rpmMetadataSource is primary_db and primary_db metadata is absent', async () => {
      mockRepomdResponse({ primaryHref: 'repodata/somesha256-primary.xml.gz' });

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
          rpmMetadataSource: 'primary_db',
        }),
      ).rejects.toThrow(`No primary_db data found in ${registryUrl}repomd.xml`);
    });

    it('throws when rpmMetadataSource is primary and primary metadata is absent', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
        primaryHref: '',
      });

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
          rpmMetadataSource: 'primary',
        }),
      ).rejects.toThrow(`No primary data found in ${registryUrl}repomd.xml`);
    });
    it('falls back to primary.xml.gz when primary_db is absent', async () => {
      mockRepomdResponse({ primaryHref: 'repodata/somesha256-primary.xml.gz' });
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
            <version epoch="0" ver="1.1"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toEqual({
        releases: [{ version: '1.0-2.azl3' }, { version: '1.1' }],
      });
    });

    it('falls back to primary.xml.gz when primary_db lookup fails', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
      });
      mockPrimaryDbResponse(gzipSync('not-a-sqlite-database'));
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="2.0" rel="1.azl3"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toEqual({
        releases: [{ version: '2.0-1.azl3' }],
      });
    });

    it('reuses the extracted primary_db file across package lookups', async () => {
      const writeSystemFileSpy = vi.spyOn(cacheFs, 'writeSystemFile');
      const repomdScope = httpMock.scope(registryUrl);
      repomdScope
        .get('/repomd.xml')
        .once()
        .reply(
          200,
          buildRepomdXml({
            primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
            primaryHref: '',
          }),
          { 'Content-Type': 'application/xml' },
        );

      const primaryDbScope = httpMock.scope(
        primaryDbUrl.replace(/\/[^/]+$/, ''),
      );
      primaryDbScope
        .get('/somesha256-primary.sqlite.gz')
        .once()
        .reply(
          200,
          await createPrimaryDbGzip([
            { name: 'bash', release: '1.azl3', version: '5.2.15' },
            { name: 'curl', release: '2.azl3', version: '8.5.0' },
          ]),
          { 'Content-Type': 'application/gzip' },
        );

      const bashReleases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'bash',
      });
      const curlReleases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'curl',
      });

      expect(bashReleases).toEqual({
        releases: [{ version: '5.2.15-1.azl3' }],
      });
      expect(curlReleases).toEqual({
        releases: [{ version: '8.5.0-2.azl3' }],
      });
      expect(writeSystemFileSpy).toHaveBeenCalledTimes(1);
    });

    it('returns null when primary_db rows do not contain a version value', async () => {
      mockRepomdResponse({
        primaryDbHref: 'repodata/somesha256-primary.sqlite.gz',
        primaryHref: '',
      });
      mockPrimaryDbResponse(
        await createPrimaryDbGzip([
          {
            name: 'example-package',
            release: '1.azl3',
            version: null,
          },
        ]),
      );

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toBeNull();
    });

    it('throws an error if neither primary nor primary_db metadata is present', async () => {
      mockRepomdResponse({
        primaryDbHref: '',
        primaryHref: '',
      });

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow(`No primary data found in ${registryUrl}repomd.xml`);
    });
  });
});
