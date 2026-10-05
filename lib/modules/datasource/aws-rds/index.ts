import {
  DescribeDBEngineVersionsCommand,
  RDSClient,
} from '@aws-sdk/client-rds';
import { coerceArray } from '../../../util/array.ts';
import { Lazy } from '../../../util/lazy.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';

export class AwsRdsDatasource extends Datasource {
  static readonly id = 'aws-rds';

  private readonly rds: Lazy<RDSClient>;

  constructor() {
    super(AwsRdsDatasource.id);
    this.rds = new Lazy(() => new RDSClient({}));
  }

  private async fetchReleases({
    packageName: serializedFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const cmd = new DescribeDBEngineVersionsCommand({
      Filters: JSON.parse(serializedFilter),
    });
    const response = await this.rds.getValue().send(cmd);
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
        key: `getReleases:${config.packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}
