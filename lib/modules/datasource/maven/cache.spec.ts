import { codeBlock } from 'common-tags';
import { mockDeep } from 'vitest-mock-extended';
import { XmlDocument } from 'xmldoc';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import * as _packageCache from '../../../util/cache/package/index.ts';
import type { HttpCache } from '../../../util/http/cache/schema.ts';
import { id as versioning } from '../../versioning/maven/index.ts';
import { getPkgReleases } from '../index.ts';
import { MavenDatasource } from './index.ts';
import { CachedMavenXml } from './schema.ts';

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
    vi.resetAllMocks();
    cache = {};

    packageCache.get.mockImplementation((_namespace, key) =>
      Promise.resolve(cache[key] as never),
    );
    packageCache.getCacheType.mockReturnValue(undefined);
    packageCache.setWithRawTtl.mockImplementation((_namespace, key, value) => {
      cache[key] = value as HttpCache;
      return Promise.resolve(null as never);
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

    const pomCache = cache[pomUrl]!;
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
        body: CachedMavenXml.parse(Fixtures.get('metadata.xml')),
      },
      timestamp,
    };
    cache[pomUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
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
    expect(httpMock.getTrace()).toEqual([]);
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
        body: CachedMavenXml.parse(Fixtures.get('metadata.xml')),
      },
      timestamp,
    };
    cache[pomUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
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
    expect(httpMock.getTrace()).toEqual([]);
  });

  it('revalidates trimmed cached XML after 304 responses', async () => {
    const staleTimestamp = '2024-01-01T00:00:00.000Z';

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
    cache[pomUrl] = {
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
    expect(cache[pomUrl].timestamp).not.toBe(staleTimestamp);
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
        body: CachedMavenXml.parse(Fixtures.get('metadata-snapshot-only.xml')),
      },
      timestamp,
    };
    cache[snapshotMetadataUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
        body: CachedMavenXml.parse(
          Fixtures.get('metadata-snapshot-version.xml'),
        ),
      },
      timestamp,
    };
    cache[snapshotPomUrl] = {
      etag: 'etag',
      httpResponse: {
        statusCode: 200,
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
    expect(httpMock.getTrace()).toEqual([]);
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
  });
});
