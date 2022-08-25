import { Readable } from 'stream';
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { DateTime } from 'luxon';
import { ReleaseResult, getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import { logger } from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import { id as versioning } from '../../versioning/maven';
import { MavenDatasource } from '.';

const datasource = MavenDatasource.id;

const baseUrlS3 = 's3://repobucket';

function get(
  depName = 'org.example:package',
  ...registryUrls: string[]
): Promise<ReleaseResult | null> {
  const conf = { versioning, datasource, depName };
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
    jest.resetAllMocks();
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
        .resolvesOnce({ Body: meta })
        .on(HeadObjectCommand, {
          Bucket: 'repobucket',
          Key: 'org/example/package/0.0.1/package-0.0.1.pom',
        })
        .resolvesOnce({ DeleteMarker: true })
        .on(HeadObjectCommand, {
          Bucket: 'repobucket',
          Key: 'org/example/package/1.0.0/package-1.0.0.pom',
        })
        .rejectsOnce('NoSuchKey')
        .on(HeadObjectCommand, {
          Bucket: 'repobucket',
          Key: 'org/example/package/1.0.1/package-1.0.1.pom',
        })
        .rejectsOnce('Unknown')
        .on(HeadObjectCommand, {
          Bucket: 'repobucket',
          Key: 'org/example/package/1.0.2/package-1.0.2.pom',
        })
        .resolvesOnce({})
        .on(HeadObjectCommand, {
          Bucket: 'repobucket',
          Key: 'org/example/package/1.0.3/package-1.0.3.pom',
        })
        .resolvesOnce({
          LastModified: DateTime.fromISO(`2020-01-01T00:00:00.000Z`).toJSDate(),
        });

      const res = await get('org.example:package', baseUrlS3);

      expect(res).toEqual({
        display: 'org.example:package',
        group: 'org.example',
        name: 'package',
        registryUrl: 's3://repobucket',
        releases: [
          { version: '1.0.2' },
          { version: '1.0.3', releaseTimestamp: '2020-01-01T00:00:00.000Z' },
        ],
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
          'Dependency lookup authorization failed. Please correct AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars'
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
          'Dependency lookup failed. Please a correct AWS_REGION env var'
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
          'S3 url not found'
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
          'S3 url not found'
        );
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
            failedUrl: 's3://repobucket/org/example/package/maven-metadata.xml',
            message: 'Unknown error',
          },
          'Unknown S3 download error'
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
        expect(logger.debug).toHaveBeenCalledWith(
          "Expecting Readable response type got 'undefined' type instead"
        );
      });
    });
  });
});
