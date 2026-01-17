import { getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

const baseUrl = defaultRegistryUrl;
const basePath = '/jvm/ga/linux/x86_64.json';

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
        .reply(200, Fixtures.getJson('oracle-graalvm-ga.json'));
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
        .reply(200, Fixtures.getJson('oracle-graalvm-jre.json'));
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
        .reply(200, Fixtures.getJson('oracle-graalvm-ga.json'));
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
        .reply(200, Fixtures.getJson('oracle-graalvm-ga.json'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'oracle-graalvm-jdk?os=linux&architecture=x86_64',
      });
      expect(res?.releases).toHaveLength(3);
      // The fixture has 4 items but only 3 have vendor=oracle-graalvm
      const versions = res?.releases.map((r) => r.version);
      expect(versions).toContain('23.0.1');
      expect(versions).toContain('21.0.5');
      expect(versions).toContain('17.0.13');
    });
  });
});
