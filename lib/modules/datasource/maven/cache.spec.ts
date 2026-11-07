import { codeBlock } from 'common-tags';
import { mockDeep } from 'vitest-mock-extended';
import { XmlDocument } from 'xmldoc';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as _packageCache from '../../../util/cache/package/index.ts';
import type { HttpCache } from '../../../util/http/cache/schema.ts';
import { Http } from '../../../util/http/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { id as versioning } from '../../versioning/maven/index.ts';
import { getPkgReleases } from '../index.ts';
import type { ReleaseResult } from '../types.ts';
import { MavenDatasource } from './index.ts';
import { CachedMavenXml } from './schema.ts';
import { downloadMavenXml } from './util.ts';

vi.mock('../../../util/cache/package/index.ts', () => mockDeep());

const packageCache = vi.mocked(_packageCache);

const packageName = 'org.example:package';
const registryUrl = 'https://repo.maven.apache.org/maven2';
const metadataUrl =
  'https://repo.maven.apache.org/maven2/org/example/package/maven-metadata.xml';
const pomUrl =
  'https://repo.maven.apache.org/maven2/org/example/package/2.0.0/package-2.0.0.pom';

describe('modules/datasource/maven/cache', () => {
  let cache: Record<string, HttpCache>;

  beforeEach(() => {
    cache = {};

    packageCache.get.mockImplementation((namespace, key) => {
      if (namespace === 'datasource-maven:metadata-not-found') {
        return Promise.resolve(null as never);
      }
      return Promise.resolve(cache[key] as never);
    });
    packageCache.getCacheType.mockReturnValue(undefined);
    packageCache.setWithRawTtl.mockImplementation((_namespace, key, value) => {
      cache[key] = value as HttpCache;
      return Promise.resolve(null as never);
    });
  });

  describe('java.version constraints', () => {
    it.each`
      firstMode   | firstJava | secondMode  | secondJava | clearMemory
      ${'none'}   | ${'17'}   | ${'strict'} | ${'17'}    | ${false}
      ${'strict'} | ${'17'}   | ${'none'}   | ${'17'}    | ${false}
      ${'strict'} | ${''}     | ${'strict'} | ${'17'}    | ${false}
      ${'strict'} | ${'17'}   | ${'strict'} | ${''}      | ${false}
      ${'none'}   | ${'17'}   | ${'strict'} | ${'17'}    | ${true}
      ${'strict'} | ${'17'}   | ${'none'}   | ${'17'}    | ${true}
      ${'strict'} | ${''}     | ${'strict'} | ${'17'}    | ${true}
      ${'strict'} | ${'17'}   | ${'strict'} | ${''}      | ${true}
    `(
      'preserves filtering when $firstMode/$firstJava precedes $secondMode/$secondJava with clearMemory=$clearMemory',
      async ({ firstMode, firstJava, secondMode, secondJava, clearMemory }) => {
        const releaseCache: Record<string, ReleaseResult> = {};
        packageCache.get.mockImplementation((namespace, key) => {
          if (namespace === 'datasource-maven:metadata-not-found') {
            return Promise.resolve(null as never);
          }
          return Promise.resolve(
            (namespace === 'datasource-releases-maven'
              ? releaseCache[key]
              : cache[key]) as never,
          );
        });
        packageCache.set.mockImplementation((namespace, key, value) => {
          if (namespace === 'datasource-releases-maven') {
            releaseCache[key] = value as ReleaseResult;
          }
          return Promise.resolve();
        });
        httpMock
          .scope(registryUrl)
          .get('/org/example/package/maven-metadata.xml')
          .reply(
            200,
            '<metadata><versioning><versions><version>1.0.0</version><version>2.0.0</version></versions></versioning></metadata>',
          )
          .get('/org/example/package/2.0.0/package-2.0.0.pom')
          .reply(
            200,
            '<project><groupId>org.example</groupId><properties><java.version>21</java.version></properties></project>',
          )
          .get('/org/example/package/1.0.0/package-1.0.0.pom')
          .optionally()
          .reply(
            200,
            '<project><groupId>org.example</groupId><properties><java.version>17</java.version></properties></project>',
          );
        const config = {
          datasource: MavenDatasource.id,
          packageName,
          registryUrls: [registryUrl],
          versioning,
        };

        const first = await getPkgReleases({
          ...config,
          constraintsFiltering: firstMode,
          constraints: { java: firstJava },
        });
        if (clearMemory) {
          memCache.reset();
        }
        const second = await getPkgReleases({
          ...config,
          constraintsFiltering: secondMode,
          constraints: { java: secondJava },
        });

        expect(first?.releases).toEqual(
          firstMode === 'strict' && firstJava
            ? [{ version: '1.0.0' }]
            : [{ version: '1.0.0' }, { version: '2.0.0' }],
        );
        expect(second?.releases).toEqual(
          secondMode === 'strict' && secondJava
            ? [{ version: '1.0.0' }]
            : [{ version: '1.0.0' }, { version: '2.0.0' }],
        );
      },
    );

    it.each([false, true])(
      'reuses enriched metadata for different Java constraints with clearMemory=%s',
      async (clearMemory) => {
        const releaseCache: Record<string, ReleaseResult> = {};
        packageCache.get.mockImplementation((namespace, key) => {
          if (namespace === 'datasource-maven:metadata-not-found') {
            return Promise.resolve(null as never);
          }
          return Promise.resolve(
            (namespace === 'datasource-releases-maven'
              ? releaseCache[key]
              : cache[key]) as never,
          );
        });
        packageCache.set.mockImplementation((namespace, key, value) => {
          if (namespace === 'datasource-releases-maven') {
            releaseCache[key] = value as ReleaseResult;
          }
          return Promise.resolve();
        });
        httpMock
          .scope(registryUrl)
          .get('/org/example/package/maven-metadata.xml')
          .reply(
            200,
            '<metadata><versioning><versions><version>1.0.0</version><version>2.0.0</version></versions></versioning></metadata>',
          )
          .get('/org/example/package/2.0.0/package-2.0.0.pom')
          .reply(
            200,
            '<project><groupId>org.example</groupId><properties><java.version>21</java.version></properties></project>',
          )
          .get('/org/example/package/1.0.0/package-1.0.0.pom')
          .optionally()
          .reply(
            200,
            '<project><groupId>org.example</groupId><properties><java.version>17</java.version></properties></project>',
          );
        const config = {
          datasource: MavenDatasource.id,
          packageName,
          registryUrls: [registryUrl],
          versioning,
          constraintsFiltering: 'strict' as const,
        };

        const java17 = await getPkgReleases({
          ...config,
          constraints: { java: '17' },
        });
        if (clearMemory) {
          memCache.reset();
        }
        const java21 = await getPkgReleases({
          ...config,
          constraints: { java: '21' },
        });

        expect(java17?.releases).toEqual([{ version: '1.0.0' }]);
        expect(java21?.releases).toEqual([{ version: '2.0.0' }]);
      },
    );

    it('filters Java constraints read from trimmed cached release POMs', async () => {
      httpMock
        .scope(registryUrl)
        .get('/org/example/package/maven-metadata.xml')
        .reply(
          200,
          '<metadata><versioning><versions><version>1.0.0</version><version>2.0.0</version></versions></versioning></metadata>',
        )
        .get('/org/example/package/2.0.0/package-2.0.0.pom')
        .reply(200, Fixtures.get('pom-java-21.xml'))
        .get('/org/example/package/1.0.0/package-1.0.0.pom')
        .reply(
          200,
          Fixtures.get('pom-java-21.xml').replace(
            '<java.version>21</java.version>',
            '<java.version>17</java.version>',
          ),
        );
      await new MavenDatasource().getReleases({
        packageName,
        registryUrl,
      });
      await downloadMavenXml(
        new Http(MavenDatasource.id),
        parseUrl(`${registryUrl}/org/example/package/1.0.0/package-1.0.0.pom`)!,
      );
      packageCache.setWithRawTtl.mockClear();

      const result = await getPkgReleases({
        datasource: MavenDatasource.id,
        packageName,
        registryUrls: [registryUrl],
        versioning,
        constraintsFiltering: 'strict',
        constraints: { java: '17' },
      });

      expect(result?.releases).toEqual([{ version: '1.0.0' }]);
      expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
    });
  });

  it('persists trimmed metadata and pom bodies', async () => {
    httpMock
      .scope(registryUrl)
      .get('/org/example/package/maven-metadata.xml')
      .reply(200, Fixtures.get('metadata.xml'))
      .get('/org/example/package/2.0.0/package-2.0.0.pom')
      .reply(200, Fixtures.get('pom.xml'));

    const result = await getPkgReleases({
      datasource: MavenDatasource.id,
      packageName,
      registryUrls: [registryUrl],
      versioning,
    });

    expect(result).toMatchObject({
      homepage: 'https://package.example.org/about',
      packageScope: 'org.example',
      tags: {
        latest: '2.0.0',
        release: '2.0.0',
      },
    });

    const metadataCache = cache[metadataUrl]!;
    const metadata = new XmlDocument(
      (metadataCache.httpResponse as { body: string }).body,
    );
    expect(metadata.valueWithPath('groupId')).toBeUndefined();
    expect(metadata.valueWithPath('artifactId')).toBeUndefined();
    expect(
      metadata.descendantWithPath('versioning.lastUpdated'),
    ).toBeUndefined();
    expect(metadata.valueWithPath('versioning.latest')).toBe('2.0.0');
    expect(metadata.valueWithPath('versioning.release')).toBe('2.0.0');

    const pomCache = cache[`v2:${pomUrl}`]!;
    const pom = new XmlDocument(
      (pomCache.httpResponse as { body: string }).body,
    );
    expect(pom.valueWithPath('groupId')).toBe('org.example');
    expect(pom.valueWithPath('url')).toBe('https://package.example.org/about');
    expect(pom.valueWithPath('name')).toBeUndefined();
    expect(pom.valueWithPath('description')).toBeUndefined();
  });

  it('serves cached trimmed XML without refetching', async () => {
    const timestamp = new Date().toISOString();
    cache[metadataUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        headers: {},
        body: CachedMavenXml.parse(Fixtures.get('metadata.xml')),
      },
      timestamp,
    };
    cache[`v2:${pomUrl}`] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        headers: {},
        body: CachedMavenXml.parse(Fixtures.get('pom.xml')),
      },
      timestamp,
    };

    const result = await getPkgReleases({
      datasource: MavenDatasource.id,
      packageName,
      registryUrls: [registryUrl],
      versioning,
    });

    expect(result).toMatchObject({
      homepage: 'https://package.example.org/about',
      packageScope: 'org.example',
      tags: {
        latest: '2.0.0',
        release: '2.0.0',
      },
    });
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
  });

  it('preserves empty relocation markers on cache hits', async () => {
    const pomWithEmptyRelocation = codeBlock`
      <project>
        <distributionManagement>
          <relocation />
        </distributionManagement>
      </project>
    `;
    const timestamp = new Date().toISOString();

    cache[metadataUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        headers: {},
        body: CachedMavenXml.parse(Fixtures.get('metadata.xml')),
      },
      timestamp,
    };
    cache[`v2:${pomUrl}`] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        headers: {},
        body: CachedMavenXml.parse(pomWithEmptyRelocation),
      },
      timestamp,
    };

    const result = await getPkgReleases({
      datasource: MavenDatasource.id,
      packageName,
      registryUrls: [registryUrl],
      versioning,
    });

    expect(result).toMatchObject({
      replacementName: 'org.example:package',
      replacementVersion: '2.0.0',
    });
  });

  it('revalidates trimmed cached XML after 304 responses', async () => {
    const staleTimestamp = '2024-01-01T00:00:00.000Z';
    const pomCacheKey = `v2:${pomUrl}`;

    cache[metadataUrl] = {
      etag: 'metadata-etag',
      lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      httpResponse: {
        statusCode: 200,
        headers: { etag: 'metadata-etag' },
        body: CachedMavenXml.parse(Fixtures.get('metadata.xml')),
      },
      timestamp: staleTimestamp,
    };
    cache[pomCacheKey] = {
      etag: 'pom-etag',
      lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      httpResponse: {
        statusCode: 200,
        headers: { etag: 'pom-etag' },
        body: CachedMavenXml.parse(Fixtures.get('pom.xml')),
      },
      timestamp: staleTimestamp,
    };

    httpMock
      .scope(registryUrl)
      .get('/org/example/package/maven-metadata.xml')
      .reply(304)
      .get('/org/example/package/2.0.0/package-2.0.0.pom')
      .reply(304);

    const result = await getPkgReleases({
      datasource: MavenDatasource.id,
      packageName,
      registryUrls: [registryUrl],
      versioning,
    });

    expect(result).toMatchObject({
      homepage: 'https://package.example.org/about',
      packageScope: 'org.example',
      tags: {
        latest: '2.0.0',
        release: '2.0.0',
      },
    });
    expect(packageCache.setWithRawTtl).toHaveBeenCalledTimes(2);
    expect(cache[metadataUrl].timestamp).not.toBe(staleTimestamp);
    expect(cache[pomCacheKey].timestamp).not.toBe(staleTimestamp);
  });

  it('serves cached trimmed snapshot XML without refetching', async () => {
    const timestamp = new Date().toISOString();
    const snapshotMetadataUrl =
      'https://repo.maven.apache.org/maven2/org/example/package/1.0.3-SNAPSHOT/maven-metadata.xml';
    const snapshotPomUrl =
      'https://repo.maven.apache.org/maven2/org/example/package/1.0.3-SNAPSHOT/package-1.0.3-20200101.010003-3.pom';

    cache[metadataUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        headers: {},
        body: CachedMavenXml.parse(Fixtures.get('metadata-snapshot-only.xml')),
      },
      timestamp,
    };
    cache[snapshotMetadataUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        headers: {},
        body: CachedMavenXml.parse(
          Fixtures.get('metadata-snapshot-version.xml'),
        ),
      },
      timestamp,
    };
    cache[`v2:${snapshotPomUrl}`] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        headers: {},
        body: CachedMavenXml.parse(Fixtures.get('pom.xml')),
      },
      timestamp,
    };

    const result = await getPkgReleases({
      datasource: MavenDatasource.id,
      packageName,
      registryUrls: [registryUrl],
      versioning,
    });

    expect(result).toEqual({
      display: 'org.example:package',
      group: 'org.example',
      homepage: 'https://package.example.org/about',
      name: 'package',
      packageScope: 'org.example',
      registryUrl,
      releases: [{ version: '1.0.3-SNAPSHOT' }],
      respectLatest: false,
      tags: {
        latest: '1.0.3-SNAPSHOT',
        release: '1.0.3-SNAPSHOT',
      },
    });
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
  });
});
