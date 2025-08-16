import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { ensureTrailingSlash } from '../../../util/url';
import * as helmVersioning from '../../versioning/helm';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { HelmRepositoryData } from './schema';
import { HelmRepository } from './schema';

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

  @cache({
    namespace: `datasource-${HelmDatasource.id}`,
    key: (helmRepository: string) => `repository-data:${helmRepository}`,
  })
  async getRepositoryData(helmRepository: string): Promise<HelmRepositoryData> {
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

  async getReleases({
    packageName,
    registryUrl: helmRepository,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
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
