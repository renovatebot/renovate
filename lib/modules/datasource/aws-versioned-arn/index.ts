import { LambdaClient } from '@aws-sdk/client-lambda';
import { cache } from '../../../util/cache/package/decorator';
import { Lazy } from '../../../util/lazy';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class AwsVersionedArnDataSource extends Datasource {
  static readonly id = 'aws-versioned-arn';

  override readonly caching = true;

  private readonly lambda: Lazy<LambdaClient>;

  constructor() {
    super(AwsVersionedArnDataSource.id);
    this.lambda = new Lazy(() => new LambdaClient({}));
  }

  @cache({
    namespace: `datasource-${AwsVersionedArnDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    return {
      releases: [],
    };
  }
}
