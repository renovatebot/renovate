import {
  DescribeAddonVersionsCommand,
  DescribeAddonVersionsCommandInput,
  EKSClient,
} from '@aws-sdk/client-eks';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { EksAddonsFilterJson } from './schema';

export class AwsEKSAddonDataSource extends Datasource {
  static readonly id = 'aws-eks-addon';

  override readonly caching = true;
  private readonly eksClients: Record<string, EKSClient> = {};

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
    const filter = EksAddonsFilterJson.safeParse(serializedFilter);
    const eksClient = this.getEKSClient(filter);

    const cmd = new DescribeAddonVersionsCommand(
      this.getDescribeAddonsRequest(filter),
    );
    const response = await eksClient.send(cmd);
    const addons = response.addons ?? [];
    return {
      releases: addons
        .flatMap((addon) => addon.addonVersions)
        .map((versionInfo) => ({
          version: versionInfo?.addonVersion ?? '',
        }))
        .filter((release) => release.version),
    };
  }

  private getDescribeAddonsRequest({
    kubernetesVersion,
    addonName,
  }: EKSAddonsFilter): DescribeAddonVersionsCommandInput {
    // this API is paginated, but we only ever care about a single addon at a time.
    return {
      kubernetesVersion,
      addonName,
      maxResults: 1,
    };
  }

  private getEKSClient({ region, profile }: EKSAddonsFilter): EKSClient {
    // we have two dimensions here, building a cache key for simplicity.
    const cacheKey = `${region ?? 'default'}#${profile ?? 'default'}`;
    if (!(cacheKey in this.eksClients)) {
      this.eksClients[cacheKey] = new EKSClient({
        region,
        credentials: fromNodeProviderChain({ profile }),
      });
    }
    return this.eksClients[cacheKey];
  }
}
