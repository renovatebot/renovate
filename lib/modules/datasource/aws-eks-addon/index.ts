import { DescribeAddonVersionsCommand, EKSClient } from '@aws-sdk/client-eks';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { cache } from '../../../util/cache/package/decorator';
import * as awsEksAddonVersioning from '../../versioning/aws-eks-addon';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { EksAddonsFilter } from './schema';

export class AwsEKSAddonDataSource extends Datasource {
  static readonly id = 'aws-eks-addon';

  override readonly defaultVersioning = awsEksAddonVersioning.id;
  override readonly caching = true;
  private readonly clients: Record<string, EKSClient> = {};

  constructor() {
    super(AwsEKSAddonDataSource.id);
  }

  @cache({
    namespace: `datasource-${AwsEKSAddonDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases({
    packageName: serializedFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res = EksAddonsFilter.safeParse(serializedFilter);
    if (!res.success) {
      logger.warn(
        { err: res.error, serializedFilter },
        'Error parsing eks-addons config.',
      );
      return null;
    }

    const filter = res.data;

    const cmd = new DescribeAddonVersionsCommand({
      kubernetesVersion: filter.kubernetesVersion,
      addonName: filter.addonName,
      maxResults: 1,
    });
    const response = await this.getClient(filter).send(cmd);
    const addons = coerceArray(response.addons);
    return {
      releases: addons
        .flatMap((addon) => {
          return addon.addonVersions;
        })
        .filter(is.truthy)
        .map((versionInfo) => ({
          version: versionInfo.addonVersion ?? '',
          default:
            versionInfo.compatibilities?.some((comp) => comp.defaultVersion) ??
            false,
          compatibleWith: versionInfo.compatibilities?.flatMap(
            (comp) => comp.clusterVersion,
          ),
        }))
        .filter((release) => release.version && release.version !== '')
        .filter((release) => {
          if (filter.default) {
            return release.default && release.default === filter.default;
          }
          return true;
        }),
    };
  }

  private getClient({ region, profile }: EksAddonsFilter): EKSClient {
    const cacheKey = `${region ?? 'default'}#${profile ?? 'default'}`;
    if (!(cacheKey in this.clients)) {
      this.clients[cacheKey] = new EKSClient({
        ...(region && { region }),
        credentials: fromNodeProviderChain(profile ? { profile } : undefined),
      });
    }
    return this.clients[cacheKey];
  }
}
