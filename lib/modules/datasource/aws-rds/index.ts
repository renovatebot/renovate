import {
  DescribeDBEngineVersionsCommand,
  RDSClient,
} from '@aws-sdk/client-rds';
import { cache } from '../../../util/cache/package/decorator';
import { Lazy } from '../../../util/lazy';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

const id = 'aws-rds';

export class AwsRdsDataSource extends Datasource {
  static readonly id = id;

  override readonly caching = true;

  private readonly rds: Lazy<RDSClient>;

  constructor() {
    super(AwsRdsDataSource.id);
    this.rds = new Lazy(() => new RDSClient({}));
  }

  @cache({
    namespace: `datasource-${id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases({
    packageName: serializedFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const cmd = new DescribeDBEngineVersionsCommand({
      Filters: JSON.parse(serializedFilter),
    });
    const response = await this.rds.getValue().send(cmd);
    const versions = response.DBEngineVersions ?? [];
    return {
      releases: versions
        .filter((version) => version.EngineVersion)
        .map((version) => ({
          version: version.EngineVersion!,
          isDeprecated: version.Status === 'deprecated',
        })),
    };
  }
}
