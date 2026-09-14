import { Readable } from 'node:stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { codeBlock } from 'common-tags';
import type { DirectoryResult } from 'tmp-promise';
import { dir as tmpDir } from 'tmp-promise';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { getPkgReleases } from '../index.ts';
import { HelmDatasource } from './index.ts';

// Truncated index.yaml file
const indexYaml = Fixtures.get('index.yaml');

describe('modules/datasource/helm/index', () => {
  const s3mock = mockClient(S3Client);

  afterEach(() => {
    s3mock.reset();
    hostRules.clear();
  });

  describe('repository cache', () => {
    let cacheDir: DirectoryResult;

    beforeEach(async () => {
      cacheDir = await tmpDir({ unsafeCleanup: true });
      GlobalConfig.reset();
      memCache.init();
      await packageCache.init({ cacheDir: cacheDir.path });
    });

    afterEach(async () => {
      await packageCache.cleanup({});
      memCache.reset();
      GlobalConfig.reset();
      await cacheDir.cleanup();
    });

    it('preserves the lookup error for malformed repository URLs', async () => {
      await expect(
        new HelmDatasource().getRepositoryData('not-a-url'),
      ).rejects.toThrow('Invalid URL');
    });

    it('does not reuse S3 repository data', async () => {
      s3mock
        .on(GetObjectCommand)
        .resolvesOnce({ Body: Readable.from([indexYaml]) as never })
        .resolvesOnce({ Body: Readable.from(['entries: {}']) as never });
      const datasource = new HelmDatasource();

      const first = await datasource.getRepositoryData(
        's3://chart-bucket/charts',
      );
      const second = await datasource.getRepositoryData(
        's3://chart-bucket/charts',
      );

      expect(first.ambassador.releases).toHaveLength(27);
      expect(second).toEqual({});
    });

    it('retains the administrator override for custom repositories', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });
      httpMock
        .scope('https://example.com')
        .get('/index.yaml')
        .reply(200, indexYaml);

      const first = await new HelmDatasource().getRepositoryData(
        'https://example.com',
      );
      memCache.reset();
      const second = await new HelmDatasource().getRepositoryData(
        'https://example.com',
      );

      expect(second).toEqual(first);
      expect(second.ambassador.releases).toHaveLength(27);
    });

    it.each([
      'https://charts.helm.sh/stable',
      'https://charts.helm.sh/stable/',
      'HTTPS://CHARTS.HELM.SH:443/stable',
      'https://charts.helm.sh/stable///',
      'https://charts.helm.sh/other/../stable',
      'https://charts.helm.sh/other/%2e%2e/stable',
    ])('reuses the public index for %s', async (registryUrl) => {
      httpMock
        .scope('https://charts.helm.sh')
        .get('/stable/index.yaml')
        .reply(200, indexYaml);
      const datasource = new HelmDatasource();

      const first = await datasource.getRepositoryData(registryUrl);
      memCache.reset();
      const second = await new HelmDatasource().getRepositoryData(registryUrl);

      expect(second).toEqual(first);
      expect(second.ambassador.releases).toHaveLength(27);
    });

    it.each([
      [
        'https://example.com/charts',
        'https://example.com',
        '/charts/index.yaml',
      ],
      [
        'https://charts.helm.sh/incubator',
        'https://charts.helm.sh',
        '/incubator/index.yaml',
      ],
      [
        'https://charts.helm.sh/stable.git',
        'https://charts.helm.sh',
        '/stable.git/index.yaml',
      ],
      [
        'https://charts.helm.sh/stable/private',
        'https://charts.helm.sh',
        '/stable/private/index.yaml',
      ],
      [
        'https://charts.helm.sh/stable%2fprivate',
        'https://charts.helm.sh',
        '/stable%2fprivate/index.yaml',
      ],
      [
        'https://charts.helm.sh/%73table',
        'https://charts.helm.sh',
        '/%73table/index.yaml',
      ],
      [
        'https://charts.helm.sh.evil.test/stable',
        'https://charts.helm.sh.evil.test',
        '/stable/index.yaml',
      ],
      [
        'https://charts.helm.sh:8443/stable',
        'https://charts.helm.sh:8443',
        '/stable/index.yaml',
      ],
      [
        'http://charts.helm.sh/stable',
        'http://charts.helm.sh',
        '/stable/index.yaml',
      ],
      [
        'https://user:secret@charts.helm.sh/stable',
        'https://charts.helm.sh',
        '/stable/index.yaml',
      ],
      [
        'https://charts.helm.sh/stable?token=secret',
        'https://charts.helm.sh',
        '/stable?token=secret/index.yaml',
      ],
      [
        'https://charts.helm.sh/stable#fragment',
        'https://charts.helm.sh',
        '/stable',
      ],
    ])(
      'bypasses a populated cache for %s',
      async (registryUrl, origin, path) => {
        await packageCache.set(
          'datasource-helm',
          `cache-decorator:repository-data:${registryUrl}`,
          {
            cachedAt: new Date().toISOString(),
            value: { stale: { releases: [] } },
          },
          30,
        );
        httpMock.scope(origin).get(path).reply(200, indexYaml);

        const result = await new HelmDatasource().getRepositoryData(
          registryUrl,
        );

        expect(result.ambassador.releases).toHaveLength(27);
        memCache.reset();
        await expect(
          packageCache.get(
            'datasource-helm',
            `cache-decorator:repository-data:${registryUrl}`,
          ),
        ).resolves.toEqual({
          cachedAt: expect.any(String),
          value: { stale: { releases: [] } },
        });
      },
    );
  });

  describe('getReleases', () => {
    it('returns null if packageName was not provided', async () => {
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: undefined as never, // #22198
          registryUrls: ['https://example-repository.com'],
        }),
      ).resolves.toBeNull();
    });

    it('returns null if repository was not provided', async () => {
      // FIXME: should it call default rtegisty?
      httpMock
        .scope('https://charts.helm.sh')
        .get('/stable/index.yaml')
        .reply(404);
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'some_chart',
          registryUrls: [],
        }),
      ).resolves.toBeNull();
    });

    it('returns null for empty response', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200);
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).resolves.toBeNull();
    });

    it('returns null for missing response body', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200);
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).resolves.toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(404);
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).resolves.toBeNull();
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
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        }),
      ).resolves.toBeNull();
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

  describe('S3', () => {
    // The AWS SDK puts the error code in `name`, not `message`
    function s3Error(
      name: string,
      message: string,
      metadata?: { httpStatusCode: number },
    ): Error {
      const err = Object.assign(new Error(message), { $metadata: metadata });
      err.name = name;
      return err;
    }

    it('returns releases from an S3 bucket', async () => {
      s3mock
        .on(GetObjectCommand, {
          Bucket: 'chart-bucket',
          Key: 'charts/index.yaml',
        })
        .resolvesOnce({ Body: Readable.from([indexYaml]) as never });

      const res = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'ambassador',
        registryUrls: ['s3://chart-bucket/charts'],
      });

      expect(res).toMatchObject({
        homepage: 'https://www.getambassador.io/',
        registryUrl: 's3://chart-bucket/charts',
        sourceUrl: 'https://github.com/datawire/ambassador',
        releases: expect.toBeArrayOfSize(27),
      });
    });

    it('uses credentials from host rules', async () => {
      hostRules.add({
        hostType: HelmDatasource.id,
        matchHost: 'chart-bucket',
        username: 'some-access-key',
        password: 'some-secret-key',
        token: 'some-session-token',
      });
      s3mock
        .on(GetObjectCommand, {
          Bucket: 'chart-bucket',
          Key: 'charts/index.yaml',
        })
        .resolvesOnce({ Body: Readable.from([indexYaml]) as never });

      const res = await getPkgReleases({
        datasource: HelmDatasource.id,
        packageName: 'ambassador',
        registryUrls: ['s3://chart-bucket/charts'],
      });

      expect(res).toMatchObject({ registryUrl: 's3://chart-bucket/charts' });
      const client = s3mock.call(0).thisValue as S3Client;
      await expect(client.config.credentials()).resolves.toMatchObject({
        accessKeyId: 'some-access-key',
        secretAccessKey: 'some-secret-key',
        sessionToken: 'some-session-token',
      });
    });

    it('returns null when the S3 object is missing', async () => {
      s3mock
        .on(GetObjectCommand)
        .rejectsOnce(s3Error('NoSuchKey', 'The specified key does not exist.'));

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).resolves.toBeNull();
    });

    it('returns null for an unsupported response body', async () => {
      s3mock.on(GetObjectCommand).resolvesOnce({ Body: undefined });

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).resolves.toBeNull();
    });

    it('returns null when the S3 object is not found', async () => {
      s3mock.on(GetObjectCommand).rejectsOnce(s3Error('NotFound', 'Not Found'));

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).resolves.toBeNull();
    });

    it('returns null when the S3 object is deleted', async () => {
      s3mock.on(GetObjectCommand).resolvesOnce({ DeleteMarker: true });

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).resolves.toBeNull();
    });

    it('throws for credentials errors', async () => {
      s3mock
        .on(GetObjectCommand)
        .rejectsOnce(
          s3Error(
            'CredentialsProviderError',
            'Could not load credentials from any providers',
          ),
        );

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws when the AWS region is missing', async () => {
      s3mock
        .on(GetObjectCommand)
        .rejectsOnce(s3Error('Error', 'Region is missing'));

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws when the bucket rejects the credentials', async () => {
      s3mock
        .on(GetObjectCommand)
        .rejectsOnce(
          s3Error(
            'InvalidAccessKeyId',
            'The Access Key Id you provided does not exist in our records.',
            { httpStatusCode: 403 },
          ),
        );

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for unknown S3 errors', async () => {
      s3mock
        .on(GetObjectCommand)
        .rejectsOnce(s3Error('AggregateError', 'connect ECONNREFUSED'));

      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          packageName: 'ambassador',
          registryUrls: ['s3://chart-bucket/charts'],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
});
