import { mockDeep } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as _packageCache from '../../../util/cache/package/index.ts';
import type { HttpCache } from '../../../util/http/cache/schema.ts';
import { id as versioning } from '../../versioning/maven/index.ts';
import { getPkgReleases } from '../index.ts';
import { MavenDatasource } from './index.ts';

vi.mock('../../../util/cache/package/index.ts', () => mockDeep());

const packageCache = vi.mocked(_packageCache);
const registryUrl = 'https://repo.maven.apache.org/maven2';
const packagePath = '/org/example/package';
const sourcePom = Fixtures.get('pom-java-21.xml');
const legacyPom = Fixtures.get('pom-java-21-legacy-cache.xml');
const versions = [
  { kind: 'release', version: '2.0.0', pomVersion: '2.0.0' },
  {
    kind: 'mutable snapshot',
    version: '2.0.0-SNAPSHOT',
    pomVersion: '2.0.0-SNAPSHOT',
  },
  {
    kind: 'timestamped snapshot',
    version: '2.0.0-SNAPSHOT',
    pomVersion: '2.0.0-20200101.010003-3',
  },
];
const cases = [
  ...versions.flatMap((entry) =>
    ['21', '', '${runtime.version}'].map((java) => ({
      ...entry,
      java,
      stale: false,
    })),
  ),
  { ...versions[1], java: '21', stale: true },
];

describe('modules/datasource/maven/cache-upgrade', () => {
  let cache: Record<string, HttpCache>;

  beforeEach(() => {
    cache = {};
    memCache.reset();
    packageCache.get.mockImplementation((namespace, key) =>
      Promise.resolve(
        (namespace === 'datasource-maven:metadata-not-found'
          ? null
          : cache[key]) as never,
      ),
    );
    packageCache.getCacheType.mockReturnValue(undefined);
    packageCache.setWithRawTtl.mockImplementation((_namespace, key, value) => {
      cache[key] = value as HttpCache;
      return Promise.resolve();
    });
  });

  it.each(cases)(
    'refreshes legacy $kind POMs with java=$java and stale=$stale, then reuses the new cache',
    async ({ kind, version, pomVersion, java, stale }) => {
      const pomPath = `${packagePath}/${version}/package-${pomVersion}.pom`;
      const pom = sourcePom.replace(
        '<java.version>21</java.version>',
        java ? `<java.version>${java}</java.version>` : '',
      );
      const freshTimestamp = new Date().toISOString();
      cache[`${registryUrl}${pomPath}`] = {
        etag: 'legacy-pom-etag',
        timestamp: stale
          ? new Date(Date.now() - 20 * 60 * 1000).toISOString()
          : freshTimestamp,
        httpResponse: { statusCode: 200, headers: {}, body: legacyPom },
      };
      if (version.endsWith('-SNAPSHOT')) {
        cache[`${registryUrl}${packagePath}/${version}/maven-metadata.xml`] = {
          timestamp: freshTimestamp,
          httpResponse: {
            statusCode: 200,
            headers: {},
            body:
              kind === 'timestamped snapshot'
                ? `<metadata><version>${version}</version><versioning><snapshot><timestamp>20200101.010003</timestamp><buildNumber>3</buildNumber></snapshot></versioning></metadata>`
                : `<metadata><version>${version}</version></metadata>`,
          },
        };
      }
      let pomRequests = 0;
      httpMock
        .scope(registryUrl)
        .get(`${packagePath}/maven-metadata.xml`)
        .reply(
          200,
          `<metadata><versioning><versions><version>${version}</version></versions></versioning></metadata>`,
        );
      httpMock
        .scope(registryUrl)
        .matchHeader('if-none-match', 'legacy-pom-etag')
        .get(pomPath)
        .optionally()
        .reply(304, () => {
          pomRequests += 1;
          return '';
        });
      httpMock
        .scope(registryUrl, {
          badheaders: ['if-none-match', 'if-modified-since'],
        })
        .get(pomPath)
        .optionally()
        .reply(200, () => {
          pomRequests += 1;
          return pom;
        });
      const config = {
        datasource: MavenDatasource.id,
        packageName: 'org.example:package',
        registryUrls: [registryUrl],
        versioning,
        constraintsFiltering: 'strict' as const,
      };

      const java17 = await getPkgReleases({
        ...config,
        constraints: { java: '17' },
      });

      expect(java17?.releases).toEqual(java === '21' ? [] : [{ version }]);
      memCache.reset();
      const java21 = await getPkgReleases({
        ...config,
        constraints: { java: '21' },
      });

      expect(java21?.releases).toEqual([{ version }]);
      expect(pomRequests).toBe(1);
    },
  );
});
