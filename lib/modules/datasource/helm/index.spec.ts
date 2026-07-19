import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { HelmDatasource } from './index.ts';

// Truncated index.yaml file
const indexYaml = Fixtures.get('index.yaml');

describe('modules/datasource/helm/index', () => {
  describe('getReleases', () => {
    it('returns null if packageName was not provided', async () => {
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: undefined as never, // #22198
          registryUrls: ['https://example-repository.com'],
        }),
      ).toBeNull();
    });

    it('returns null if repository was not provided', async () => {
      // FIXME: should it call default rtegisty?
      httpMock
        .scope('https://charts.helm.sh')
        .get('/stable/index.yaml')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'some_chart',
          registryUrls: [],
        }),
      ).toBeNull();
    });

    it('returns null for empty response', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).toBeNull();
    });

    it('returns null for missing response body', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(502);
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .replyWithError('');
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).toBeNull();
    });

    it('returns null if index.yaml in response is empty', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, '# A comment');
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });

    it('returns null if index.yaml in response is invalid', async () => {
      const res = {
        body: codeBlock`
          some
                               invalid:
                               [
                               yaml
        `,
      };
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, res);
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });

    it('returns null if packageName is not in index.yaml', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, indexYaml);
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });

    it('returns list of versions for normal response', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, indexYaml);
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'ambassador',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).not.toBeNull();
      expect(releases).toMatchObject({
        releases: [
          {
            newDigest:
              'aa09c62be843190cc85736ba59d6411579d83ba30e9305e6b2420ea013bb5979',
            version: '1.0.0',
          },
          {
            newDigest:
              '01da3c15cdec999b5afd73ee9186c62859c35a716688359c425fc04100a22144',
            releaseTimestamp: '2019-02-14T15:25:43.743Z',
            version: '1.1.0',
          },
          { version: '1.1.1' },
          { version: '1.1.2' },
          { version: '1.1.3' },
          { version: '1.1.4' },
          { version: '1.1.5' },
          { version: '2.0.0' },
          { version: '2.0.1' },
          { version: '2.0.2' },
          { version: '2.1.0' },
          { version: '2.2.0' },
          { version: '2.2.1' },
          { version: '2.2.2' },
          { version: '2.2.3' },
          { version: '2.2.4' },
          { version: '2.2.5' },
          { version: '2.3.0' },
          { version: '2.3.1' },
          { version: '2.4.0' },
          { version: '2.4.1' },
          { version: '2.5.0' },
          { version: '2.5.1' },
          { version: '2.6.0' },
          { version: '2.6.1' },
          { version: '2.6.2' },
          { version: '2.7.0' },
        ],
      });
    });

    it('returns list of versions for other packages if one packages has no versions', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, Fixtures.get('index_emptypackage.yaml'));
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'ambassador',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toMatchObject({
        homepage: 'https://www.getambassador.io/',
        registryUrl: 'https://example-repository.com',
        sourceUrl: 'https://github.com/datawire/ambassador',
        releases: expect.toBeArrayOfSize(1),
      });
    });

    it('adds trailing slash to subdirectories', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/subdir/index.yaml')
        .reply(200, indexYaml);
      const res = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'ambassador',
        registryUrls: ['https://example-repository.com/subdir'],
      });

      expect(res).toMatchObject({
        homepage: 'https://www.getambassador.io/',
        registryUrl: 'https://example-repository.com/subdir',
        sourceUrl: 'https://github.com/datawire/ambassador',
        releases: expect.toBeArrayOfSize(27),
      });
    });

    it('uses undefined as the newDigest when no digest is provided', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, Fixtures.get('index_blank-digest.yaml'));
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'blank-digest',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toMatchObject({
        registryUrl: 'https://example-repository.com',
        releases: [
          {
            newDigest: undefined,
            releaseTimestamp: '2023-09-05T13:24:19.046Z',
            version: '3.2.1',
          },
        ],
      });
    });
  });
});
