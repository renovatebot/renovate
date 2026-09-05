import { Readable } from 'node:stream';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { S3UrlParts } from '../../../util/s3.ts';
import { getS3Client, parseS3Url } from '../../../util/s3.ts';
import { streamToString } from '../../../util/streams.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import * as helmVersioning from '../../versioning/helm/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { HelmRepository } from './schema.ts';

export class HelmDatasource extends Datasource {
  static readonly id = 'helm';

  constructor() {
    super(HelmDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://charts.helm.sh/stable'];

  override readonly defaultConfig = {
    commitMessageTopic: 'Helm release {{depName}}',
  };

  override readonly defaultVersioning = helmVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timstamp is determined from the `created` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `home` field or the `sources` field in the results.';

  private async _getRepositoryData(
    helmRepository: string,
  ): Promise<HelmRepository> {
    const indexUrl = `${ensureTrailingSlash(helmRepository)}index.yaml`;

    const s3Url = parseS3Url(indexUrl);
    if (s3Url) {
      return await getS3RepositoryData(s3Url, indexUrl);
    }

    const { val, err } = await this.http
      .getYamlSafe(
        'index.yaml',
        { baseUrl: ensureTrailingSlash(helmRepository) },
        HelmRepository,
      )
      .unwrap();

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }

  getRepositoryData(helmRepository: string): Promise<HelmRepository> {
    return withCache(
      {
        namespace: `datasource-${HelmDatasource.id}`,
        key: `repository-data:${helmRepository}`,
      },
      () => this._getRepositoryData(helmRepository),
    );
  }

  async getReleases({
    packageName,
    registryUrl: helmRepository,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next -- should never happen */
    if (!helmRepository) {
      return null;
    }

    const repositoryData = await this.getRepositoryData(helmRepository);
    const releases = repositoryData[packageName];
    if (!releases) {
      logger.debug(
        { dependency: packageName },
        `Entry ${packageName} doesn't exist in index.yaml from ${helmRepository}`,
      );
      return null;
    }
    return releases;
  }
}

async function getS3RepositoryData(
  s3Url: S3UrlParts,
  indexUrl: string,
): Promise<HelmRepository> {
  const client = getS3Client(undefined, undefined, getS3Credentials(indexUrl));
  const { Body } = await client.send(new GetObjectCommand(s3Url));
  if (!(Body instanceof Readable)) {
    logger.debug({ indexUrl }, 'Helm S3 lookup error: unsupported Body type');
    throw new Error(`Unsupported S3 response body for ${indexUrl}`);
  }
  return parseSingleYaml(await streamToString(Body), {
    customSchema: HelmRepository,
  });
}

function getS3Credentials(
  indexUrl: string,
): S3ClientConfig['credentials'] | undefined {
  const { username, password, token } = hostRules.find({
    hostType: HelmDatasource.id,
    url: indexUrl,
  });

  // Fall back to the default AWS credential provider chain
  if (!username || !password) {
    return undefined;
  }

  return {
    accessKeyId: username,
    secretAccessKey: password,
    sessionToken: token,
  };
}
