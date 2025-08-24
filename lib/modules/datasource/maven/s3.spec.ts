import { Readable } from 'node:stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import type { ReleaseResult } from '..';
import { getPkgReleases } from '..';
import { logger } from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import { id as versioning } from '../../versioning/maven';
import { MavenDatasource } from '.';
import { Fixtures } from '~test/fixtures';

const datasource = MavenDatasource.id;

const baseUrlS3 = 's3://repobucket';

function get(
  packageName = 'org.example:package',
  ...registryUrls: string[]
): Promise<ReleaseResult | null> {
  const conf = { versioning, datasource, packageName };
  return getPkgReleases(registryUrls ? { ...conf, registryUrls } : conf);
}

const meta = Readable.from(Fixtures.getBinary('metadata-s3.xml'));

describe('modules/datasource/maven/s3', () => {
  const s3mock = mockClient(S3Client);

  beforeEach(() => {
    hostRules.add({
      hostType: datasource,
      matchHost: 'custom.registry.renovatebot.com',
      token: '123test',
    });
  });

  afterEach(() => {
    s3mock.reset();
    hostRules.clear();
  });

  describe('S3', () => {
    it('returns releases', async () => {
      s3mock
        .on(GetObjectCommand, {
          Bucket: 'repobucket',
          Key: 'org/example/package/maven-metadata.xml',
        })
        .resolvesOnce({
          Body: meta as never,
          LastModified: new Date('2020-01-01T00:00Z'),
        });

      const res = await get('org.example:package', baseUrlS3);

      expect(res).toEqual({
        display: 'org.example:package',
        group: 'org.example',
        name: 'package',
        registryUrl: 's3://repobucket',
        releases: [
          { version: '0.0.1' },
          { version: '1.0.0' },
          { version: '1.0.1' },
          { version: '1.0.2' },
          { version: '1.0.3' },
        ],
        respectLatest: false,
        tags: {
          latest: '1.0.2',
          release: '1.0.2',
        },
        isPrivate: true,
      });
    });

    describe('errors', () => {
      it('returns null on auth error', async () => {
        class CredentialsProviderError extends Error {
          constructor() {
            super();
            this.name = 'CredentialsProviderError';
          }
        }

        s3mock
          .on(GetObjectCommand, {
            Bucket: 'repobucket',
            Key: 'org/example/package/maven-metadata.xml',
          })
          .rejectsOnce(new CredentialsProviderError());

        const res = await get('org.example:package', baseUrlS3);

        expect(res).toBeNull();
        expect(logger.debug).toHaveBeenCalledWith(
          {
            failedUrl: 's3://repobucket/org/example/package/maven-metadata.xml',
          },
          'Maven S3 lookup error: credentials provider error, check "AWS_ACCESS_KEY_ID" and "AWS_SECRET_ACCESS_KEY" variables',
        );
      });

      it('returns null for incorrect region', async () => {
        s3mock
          .on(GetObjectCommand, {
            Bucket: 'repobucket',
            Key: 'org/example/package/maven-metadata.xml',
          })
          .rejectsOnce('Region is missing');

        const res = await get('org.example:package', baseUrlS3);

        expect(res).toBeNull();
        expect(logger.debug).toHaveBeenCalledWith(
          {
            failedUrl: 's3://repobucket/org/example/package/maven-metadata.xml',
          },
          'Maven S3 lookup error: missing region, check "AWS_REGION" variable',
        );
      });

      it('returns null for NoSuchKey error', async () => {
        s3mock
          .on(GetObjectCommand, {
            Bucket: 'repobucket',
            Key: 'org/example/package/maven-metadata.xml',
          })
          .rejectsOnce('NoSuchKey');

        const res = await get('org.example:package', baseUrlS3);

        expect(res).toBeNull();
        expect(logger.trace).toHaveBeenCalledWith(
          {
            failedUrl: 's3://repobucket/org/example/package/maven-metadata.xml',
          },
          'Maven S3 lookup error: object not found',
        );
      });

      it('returns null for NotFound error', async () => {
        s3mock
          .on(GetObjectCommand, {
            Bucket: 'repobucket',
            Key: 'org/example/package/maven-metadata.xml',
          })
          .rejectsOnce('NotFound');

        const res = await get('org.example:package', baseUrlS3);

        expect(res).toBeNull();
        expect(logger.trace).toHaveBeenCalledWith(
          {
            failedUrl: 's3://repobucket/org/example/package/maven-metadata.xml',
          },
          'Maven S3 lookup error: object not found',
        );
      });

      it('returns null for Deleted marker', async () => {
        s3mock
          .on(GetObjectCommand, {
            Bucket: 'repobucket',
            Key: 'org/example/package/maven-metadata.xml',
          })
          .resolvesOnce({ DeleteMarker: true });

        const res = await get('org.example:package', baseUrlS3);

        expect(res).toBeNull();
      });

      it('returns null for unknown error', async () => {
        s3mock
          .on(GetObjectCommand, {
            Bucket: 'repobucket',
            Key: 'org/example/package/maven-metadata.xml',
          })
          .rejectsOnce('Unknown error');

        const res = await get('org.example:package', baseUrlS3);

        expect(res).toBeNull();
        expect(logger.debug).toHaveBeenCalledWith(
          {
            err: expect.objectContaining({ message: 'Unknown error' }),
            failedUrl: 's3://repobucket/org/example/package/maven-metadata.xml',
          },
          'Maven S3 lookup error: unknown error',
        );
      });

      it('returns null for unexpected response type', async () => {
        s3mock
          .on(GetObjectCommand, {
            Bucket: 'repobucket',
            Key: 'org/example/package/maven-metadata.xml',
          })
          .resolvesOnce({});
        expect(await get('org.example:package', baseUrlS3)).toBeNull();
      });
    });
  });
});
