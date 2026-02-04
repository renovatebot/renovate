import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { range } from '../../../util/range.ts';
import { getPkgReleases } from '../index.ts';
import { adoptiumRegistryUrl } from './adoptium.ts';
import { datasource, defaultRegistryUrl, pageSize } from './common.ts';
import { graalvmRegistryUrl } from './graalvm.ts';

function getPath(page: number, imageType = 'jdk', args = ''): string {
  return `/v3/info/release_versions?page_size=${pageSize}&image_type=${imageType}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC${args}&page=${page}`;
}

const oracleGraalvmJdkReleases = [
  {
    checksum:
      'sha256:46ec9582ebe114f93470403f2cc123238ac0c7982129c358af7d8e1de52dd663',
    created_at: '2025-03-28T22:04:32.319048',
    features: [],
    file_type: 'tar.gz',
    image_type: 'jdk',
    java_version: '23.0.1',
    jvm_impl: 'hotspot',
    url: 'https://download.oracle.com/graalvm/23/archive/graalvm-jdk-23.0.1_linux-x64_bin.tar.gz',
    vendor: 'oracle-graalvm',
    version: '23.0.1',
  },
  {
    checksum:
      'sha256:2d6696aa209daa098c51fefc51906aa7bf0dbe28dcc560ef738328352564181b',
    created_at: '2025-03-28T22:04:32.319048',
    features: [],
    file_type: 'tar.gz',
    image_type: 'jdk',
    java_version: '21.0.5',
    jvm_impl: 'hotspot',
    url: 'https://download.oracle.com/graalvm/21/archive/graalvm-jdk-21.0.5_linux-x64_bin.tar.gz',
    vendor: 'oracle-graalvm',
    version: '21.0.5',
  },
  {
    checksum: null,
    created_at: '2025-03-28T22:04:32.319048',
    features: [],
    file_type: 'tar.gz',
    image_type: 'jdk',
    java_version: '17.0.13',
    jvm_impl: 'hotspot',
    url: 'https://download.oracle.com/graalvm/17/latest/graalvm-jdk-17_linux-x64_bin.tar.gz',
    vendor: 'oracle-graalvm',
    version: '17.0.13',
  },
  {
    checksum:
      'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    created_at: '2024-11-15T10:20:30.123456',
    features: [],
    file_type: 'tar.gz',
    image_type: 'jdk',
    java_version: '11.0.22',
    jvm_impl: 'hotspot',
    url: 'https://download.oracle.com/graalvm/11/archive/graalvm-jdk-11.0.22_linux-x64_bin.tar.gz',
    vendor: 'graalvm',
    version: '11.0.22',
  },
];

const oracleGraalvmJreReleases = [
  {
    checksum:
      'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    created_at: '2025-03-28T22:04:32.319048',
    features: [],
    file_type: 'tar.gz',
    image_type: 'jre',
    java_version: '21.0.5',
    jvm_impl: 'hotspot',
    url: 'https://download.oracle.com/graalvm/21/archive/graalvm-jre-21.0.5_linux-x64_bin.tar.gz',
    vendor: 'oracle-graalvm',
    version: '21.0.5',
  },
  {
    checksum: null,
    created_at: '2025-03-28T22:04:32.319048',
    features: [],
    file_type: 'tar.gz',
    image_type: 'jre',
    java_version: '17.0.13',
    jvm_impl: 'hotspot',
    url: 'https://download.oracle.com/graalvm/17/latest/graalvm-jre-17_linux-x64_bin.tar.gz',
    vendor: 'oracle-graalvm',
    version: '17.0.13',
  },
];

describe('modules/datasource/java-version/index', () => {
  describe('getReleases', () => {
    describe('Adoptium (Temurin)', () => {
      it('throws for error', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0))
          .replyWithError('error');
        await expect(
          getPkgReleases({
            datasource,
            packageName: 'adoptium-jdk',
          }),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });

      it('returns null for 404', async () => {
        httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(404);
        expect(
          await getPkgReleases({
            datasource,
            packageName: 'adoptium-jdk',
          }),
        ).toBeNull();
      });

      it('returns null for empty result', async () => {
        httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(200, {});
        expect(
          await getPkgReleases({
            datasource,
            packageName: 'adoptium-jdk',
          }),
        ).toBeNull();
      });

      it('returns null for empty 200 OK', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0))
          .reply(200, { versions: [] });
        expect(
          await getPkgReleases({
            datasource,
            packageName: 'adoptium-jdk',
          }),
        ).toBeNull();
      });

      it('throws for 5xx', async () => {
        httpMock.scope(defaultRegistryUrl).get(getPath(0)).reply(502);
        await expect(
          getPkgReleases({
            datasource,
            packageName: 'adoptium-jdk',
          }),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });

      it('processes real data', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0))
          .reply(200, Fixtures.get('page.json'));
        const res = await getPkgReleases({
          datasource,
          packageName: 'adoptium-jdk',
        });
        expect(res).toMatchSnapshot();
        expect(res?.releases).toHaveLength(3);
      });

      it('processes real data (jre)', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0, 'jre'))
          .reply(200, Fixtures.get('jre.json'));
        const res = await getPkgReleases({
          datasource,
          packageName: 'adoptium-jre',
        });
        expect(res).toMatchSnapshot();
        expect(res?.releases).toHaveLength(2);
      });

      it('processes real data (jre,windows,x64)', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0, 'jre', '&os=windows&architecture=x64'))
          .reply(200, Fixtures.get('jre.json'));
        const res = await getPkgReleases({
          datasource,
          packageName: 'adoptium-jre?os=windows&architecture=x64',
        });
        expect(res?.releases).toHaveLength(2);
      });

      it('pages', async () => {
        const versions = [...range(1, 50)].map((v: number) => ({
          semver: `1.${v}.0`,
        }));
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0))
          .reply(200, { versions })
          .get(getPath(1))
          .reply(404);
        const res = await getPkgReleases({
          datasource,
          packageName: 'adoptium-jdk',
        });
        expect(res).toMatchSnapshot();
        expect(res?.releases).toHaveLength(50);
      });

      it('processes real data (jre,system)', async () => {
        vi.spyOn(process, 'arch', 'get').mockReturnValueOnce('ia32');
        vi.spyOn(process, 'platform', 'get').mockReturnValueOnce('win32');
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0, 'jre', '&os=windows&architecture=x86'))
          .reply(200, Fixtures.get('jre.json'));
        const res = await getPkgReleases({
          datasource,
          packageName: 'adoptium-jre?system=true',
        });
        expect(res?.releases).toHaveLength(2);
      });

      // Backwards compatibility tests
      it('handles legacy name: java', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0))
          .reply(200, Fixtures.get('page.json'));
        const res = await getPkgReleases({
          datasource,
          packageName: 'java',
        });
        expect(res?.releases).toHaveLength(3);
      });

      it('handles legacy name: java-jdk', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0))
          .reply(200, Fixtures.get('page.json'));
        const res = await getPkgReleases({
          datasource,
          packageName: 'java-jdk',
        });
        expect(res?.releases).toHaveLength(3);
      });

      it('handles legacy name: java-jre', async () => {
        httpMock
          .scope(defaultRegistryUrl)
          .get(getPath(0, 'jre'))
          .reply(200, Fixtures.get('jre.json'));
        const res = await getPkgReleases({
          datasource,
          packageName: 'java-jre',
        });
        expect(res?.releases).toHaveLength(2);
      });
    });

    describe('Oracle GraalVM', () => {
      const graalvmBasePath = '/jvm/ga/linux/x86_64.json';

      it('throws for network error', async () => {
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .replyWithError('network error');
        await expect(
          getPkgReleases({
            datasource,
            packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
            registryUrls: [graalvmRegistryUrl],
          }),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });

      it('returns null for 404', async () => {
        httpMock.scope(graalvmRegistryUrl).get(graalvmBasePath).reply(404);
        expect(
          await getPkgReleases({
            datasource,
            packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
            registryUrls: [graalvmRegistryUrl],
          }),
        ).toBeNull();
      });

      it('returns null for empty result', async () => {
        httpMock.scope(graalvmRegistryUrl).get(graalvmBasePath).reply(200, []);
        expect(
          await getPkgReleases({
            datasource,
            packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
            registryUrls: [graalvmRegistryUrl],
          }),
        ).toBeNull();
      });

      it('throws for 5xx', async () => {
        httpMock.scope(graalvmRegistryUrl).get(graalvmBasePath).reply(502);
        await expect(
          getPkgReleases({
            datasource,
            packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
            registryUrls: [graalvmRegistryUrl],
          }),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });

      it('processes real data for JDK', async () => {
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .reply(200, oracleGraalvmJdkReleases);
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
          registryUrls: [graalvmRegistryUrl],
        });
        expect(res?.releases).toHaveLength(3);
        expect(res?.homepage).toBe('https://www.oracle.com/java/graalvm/');
        expect(res?.sourceUrl).toBe('https://github.com/oracle/graal');
        const versions = res?.releases.map((r) => r.version);
        expect(versions).toContain('23.0.1');
        expect(versions).toContain('21.0.5');
        expect(versions).toContain('17.0.13');
      });

      it('processes real data for JRE', async () => {
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .reply(200, oracleGraalvmJreReleases);
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jre?os=linux&architecture=x86_64',
          registryUrls: [graalvmRegistryUrl],
        });
        expect(res?.releases).toHaveLength(2);
      });

      it('uses system detection', async () => {
        vi.spyOn(process, 'arch', 'get').mockReturnValueOnce('x64');
        vi.spyOn(process, 'platform', 'get').mockReturnValueOnce('linux');
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .reply(200, oracleGraalvmJdkReleases);
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?system=true',
          registryUrls: [graalvmRegistryUrl],
        });
        expect(res?.releases).toHaveLength(3);
      });

      it('handles early access releases', async () => {
        httpMock
          .scope(graalvmRegistryUrl)
          .get('/jvm/ea/linux/x86_64.json')
          .reply(200, []);
        const res = await getPkgReleases({
          datasource,
          packageName:
            'oracle-graalvm-jdk?os=linux&architecture=x86_64&release-type=ea',
          registryUrls: [graalvmRegistryUrl],
        });
        expect(res).toBeNull();
      });

      it('returns null when system detection fails', async () => {
        vi.spyOn(process, 'arch', 'get').mockReturnValueOnce(
          'unsupported' as any,
        );
        vi.spyOn(process, 'platform', 'get').mockReturnValueOnce(
          'unsupported' as any,
        );
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?system=true',
        });
        expect(res).toBeNull();
      });

      it('returns null when only OS is missing', async () => {
        vi.spyOn(process, 'arch', 'get').mockReturnValueOnce('x64');
        vi.spyOn(process, 'platform', 'get').mockReturnValueOnce(
          'unsupported' as any,
        );
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?system=true',
        });
        expect(res).toBeNull();
      });

      it('returns null when only architecture is missing', async () => {
        vi.spyOn(process, 'arch', 'get').mockReturnValueOnce(
          'unsupported' as any,
        );
        vi.spyOn(process, 'platform', 'get').mockReturnValueOnce('linux');
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?system=true',
        });
        expect(res).toBeNull();
      });

      it('filters by vendor correctly', async () => {
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .reply(200, oracleGraalvmJdkReleases);
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
          registryUrls: [graalvmRegistryUrl],
        });
        expect(res?.releases).toHaveLength(3);
        // The data has 4 items but only 3 have vendor=oracle-graalvm
        const versions = res?.releases.map((r) => r.version);
        expect(versions).toContain('23.0.1');
        expect(versions).toContain('21.0.5');
        expect(versions).toContain('17.0.13');
      });

      it('returns null for undefined response body', async () => {
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .reply(200, undefined);
        expect(
          await getPkgReleases({
            datasource,
            packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
            registryUrls: [graalvmRegistryUrl],
          }),
        ).toBeNull();
      });

      it('returns null when OS is explicitly missing', async () => {
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?architecture=x86_64',
        });
        expect(res).toBeNull();
      });

      it('returns null when architecture is explicitly missing', async () => {
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux',
        });
        expect(res).toBeNull();
      });

      it('supports custom registry URL', async () => {
        const customUrl = 'https://custom-registry.example.com/';
        httpMock
          .scope(customUrl)
          .get('/jvm/ga/linux/x86_64.json')
          .reply(200, oracleGraalvmJdkReleases);
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
          registryUrls: [customUrl],
        });
        expect(res?.releases).toHaveLength(3);
        expect(res?.registryUrl).toBe('https://custom-registry.example.com');
      });

      it('supports different custom registry URL for JRE releases', async () => {
        const customUrl = 'https://mirror.company.org/graalvm/';
        httpMock
          .scope(customUrl)
          .get('/jvm/ga/linux/x86_64.json')
          .reply(200, oracleGraalvmJreReleases);
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jre?os=linux&architecture=x86_64',
          registryUrls: [customUrl],
        });
        expect(res?.releases).toHaveLength(2);
        expect(res?.registryUrl).toBe('https://mirror.company.org/graalvm');
        const versions = res?.releases.map((r) => r.version);
        expect(versions).toContain('21.0.5');
        expect(versions).toContain('17.0.13');
      });

      it('returns null when all releases are filtered out', async () => {
        // Mock data has vendor='graalvm' (not matching oracle-graalvm)
        const nonMatchingReleases = [
          {
            checksum: 'sha256:abc',
            created_at: '2025-03-28T22:04:32.319048',
            features: [],
            file_type: 'tar.gz',
            image_type: 'jdk',
            java_version: '11.0.22',
            jvm_impl: 'hotspot',
            url: 'https://example.com/graalvm.tar.gz',
            vendor: 'graalvm',
            version: '11.0.22',
          },
        ];
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .reply(200, nonMatchingReleases);
        const res = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
          registryUrls: [graalvmRegistryUrl],
        });
        expect(res).toBeNull();
      });

      it('uses adoptium registry for adoptium and graalvm registry for graalvm', async () => {
        // Test that Adoptium uses adoptiumRegistryUrl
        httpMock
          .scope(adoptiumRegistryUrl)
          .get(getPath(0))
          .reply(200, Fixtures.get('page.json'));
        const adoptiumRes = await getPkgReleases({
          datasource,
          packageName: 'adoptium-jdk',
        });
        expect(adoptiumRes?.releases).toHaveLength(3);

        // Test that GraalVM uses graalvmRegistryUrl
        httpMock
          .scope(graalvmRegistryUrl)
          .get(graalvmBasePath)
          .reply(200, oracleGraalvmJdkReleases);
        const graalvmRes = await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
          registryUrls: [graalvmRegistryUrl],
        });
        expect(graalvmRes?.releases).toHaveLength(3);
      });
    });
  });
});
