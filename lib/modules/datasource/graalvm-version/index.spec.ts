import { getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';
import * as httpMock from '~test/http-mock';

const baseUrl = defaultRegistryUrl;
const basePath = '/jvm/ga/linux/x86_64.json';

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

describe('modules/datasource/graalvm-version/index', () => {
  describe('getReleases', () => {
    it('throws for network error', async () => {
      httpMock.scope(baseUrl).get(basePath).replyWithError('network error');
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(basePath).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
        }),
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get(basePath).reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(basePath).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data for JDK', async () => {
      httpMock
        .scope(baseUrl)
        .get(basePath)
        .reply(200, oracleGraalvmJdkReleases);
      const res = await getPkgReleases({
        datasource,
        packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
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
        .scope(baseUrl)
        .get(basePath)
        .reply(200, oracleGraalvmJreReleases);
      const res = await getPkgReleases({
        datasource,
        packageName: 'oracle-graalvm-jre?os=linux&architecture=x86_64',
      });
      expect(res?.releases).toHaveLength(2);
    });

    it('uses system detection', async () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValueOnce('x64');
      vi.spyOn(process, 'platform', 'get').mockReturnValueOnce('linux');
      httpMock
        .scope(baseUrl)
        .get(basePath)
        .reply(200, oracleGraalvmJdkReleases);
      const res = await getPkgReleases({
        datasource,
        packageName: 'oracle-graalvm-jdk?system=true',
      });
      expect(res?.releases).toHaveLength(3);
    });

    it('handles early access releases', async () => {
      httpMock.scope(baseUrl).get('/jvm/ea/linux/x86_64.json').reply(200, []);
      const res = await getPkgReleases({
        datasource,
        packageName:
          'oracle-graalvm-jdk?os=linux&architecture=x86_64&releaseType=ea',
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

    it('filters by vendor correctly', async () => {
      httpMock
        .scope(baseUrl)
        .get(basePath)
        .reply(200, oracleGraalvmJdkReleases);
      const res = await getPkgReleases({
        datasource,
        packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
      });
      expect(res?.releases).toHaveLength(3);
      // The data has 4 items but only 3 have vendor=oracle-graalvm
      const versions = res?.releases.map((r) => r.version);
      expect(versions).toContain('23.0.1');
      expect(versions).toContain('21.0.5');
      expect(versions).toContain('17.0.13');
    });

    it('returns null for null response body', async () => {
      httpMock.scope(baseUrl).get(basePath).reply(200, null);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
        }),
      ).toBeNull();
    });
  });
});
