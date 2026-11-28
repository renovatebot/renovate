import type { Filter } from '@aws-sdk/client-rds';
import {
  DescribeDBEngineVersionsCommand,
  RDSClient,
} from '@aws-sdk/client-rds';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { coerceArray } from '../../../util/array.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import type { AwsClientConfig, ParsedConfig } from './types.ts';

export class AwsRdsDatasource extends Datasource {
  static readonly id = 'aws-rds';

  private readonly clients: Record<string, RDSClient> = {};

  constructor() {
    super(AwsRdsDatasource.id);
  }

  private isRdsFilter(config: Filter | AwsClientConfig): config is Filter {
    return 'Name' in config && 'Values' in config;
  }

  loadConfig(serializedFilter: string): [Filter[], AwsClientConfig] {
    const parsedConfig: ParsedConfig = JSON.parse(serializedFilter);
    const filters: Filter[] = [];
    let config: AwsClientConfig = {};
    for (const elem of parsedConfig) {
      if (this.isRdsFilter(elem)) {
        // Separate actual RDS filters from aws client config
        filters.push(elem);
      } else {
        // merge config objects if there are multiple
        config = Object.assign(config, elem);
      }
    }
    return [filters, config];
  }

  private async fetchReleases({
    packageName: serializedFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const [filters, clientConfig] = this.loadConfig(serializedFilter);
    const cmd = new DescribeDBEngineVersionsCommand({
      Filters: filters,
    });
    const response = await this.getClient(clientConfig).send(cmd);
    const versions = coerceArray(response.DBEngineVersions);
    return {
      releases: versions
        .filter((version) => version.EngineVersion)
        .map((version) => ({
          version: version.EngineVersion!,
          isDeprecated: version.Status === 'deprecated',
        })),
    };
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: buildCacheKey('getReleases', config.packageName),
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }

  private getClient({ region, profile }: AwsClientConfig): RDSClient {
    const clientKey = `${region ?? 'default'}#${profile ?? 'default'}`;
    if (!(clientKey in this.clients)) {
      const { password, token, username } = hostRules.find({
        hostType: AwsRdsDatasource.id,
      });
      this.clients[clientKey] = new RDSClient({
        ...(region && { region }),
        credentials:
          username && password
            ? {
                accessKeyId: username,
                secretAccessKey: password,
                sessionToken: token,
              }
            : fromNodeProviderChain(profile ? { profile } : undefined),
      });
    }
    return this.clients[clientKey];
  }
}
