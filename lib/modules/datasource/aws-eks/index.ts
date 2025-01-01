import {
  type ClusterVersionInformation,
  DescribeClusterVersionsCommand,
  type DescribeClusterVersionsCommandInput,
  type DescribeClusterVersionsCommandOutput,
  EKSClient,
} from '@aws-sdk/client-eks';

import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { EksFilter } from './schema';

export class AwsEKSDataSource extends Datasource {
  static readonly id = 'aws-eks';

  override readonly caching = true;
  private readonly clients: Record<string, EKSClient> = {};

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `endOfStandardSupportDate` field in the results.';

  override readonly defaultConfig: Record<string, unknown> | undefined = {
    commitMessageTopic: '{{{datasource}}}',
    commitMessageExtra: '{{{currentVersion}}} to {{{newVersion}}}',
    prBodyDefinitions: {
      Package: '```{{{datasource}}}```',
    },
  };

  constructor() {
    super(AwsEKSDataSource.id);
  }

  @cache({
    namespace: `datasource-${AwsEKSDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases({
    packageName: serializedFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res = EksFilter.safeParse(serializedFilter);
    if (!res.success) {
      logger.error(
        { err: res.error.message, serializedFilter },
        'Error parsing eks config.',
      );
      return null;
    }

    const input: DescribeClusterVersionsCommandInput = {
      defaultOnly: res.data.default ?? undefined,
    };
    const cmd = new DescribeClusterVersionsCommand(input);
    const response: DescribeClusterVersionsCommandOutput = await this.getClient(
      res.data,
    ).send(cmd);
    const results: ClusterVersionInformation[] = response.clusterVersions ?? [];
    return {
      releases: results
        .filter(
          (el): el is ClusterVersionInformation & { clusterVersion: string } =>
            Boolean(el.clusterVersion),
        )
        .map((el) => ({
          version: el.clusterVersion,
        })),
    };
  }

  private getClient({ region, profile }: EksFilter): EKSClient {
    const cacheKey = `${region ?? 'default'}#${profile ?? 'default'}`;
    if (!(cacheKey in this.clients)) {
      this.clients[cacheKey] = new EKSClient({
        region: region ?? undefined,
        credentials: fromNodeProviderChain(profile ? { profile } : undefined),
      });
    }
    return this.clients[cacheKey];
  }
}
