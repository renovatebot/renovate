import {
  LambdaClient,
  LayerVersionsListItem,
  ListLayerVersionsCommand,
} from '@aws-sdk/client-lambda';
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
    key: (serializedArnFilter: string) =>
      `getSortedLambdaLayerVersions:${serializedArnFilter}`,
  })
  async getSortedLambdaLayerVersions(
    serializedLambdaLayerFilter: string
  ): Promise<LayerVersionsListItem[]> {
    const cmd = new ListLayerVersionsCommand({
      LayerName: JSON.parse(serializedLambdaLayerFilter),
    });

    const matchingLayerVersions = await this.lambda.getValue().send(cmd);
    matchingLayerVersions.LayerVersions =
      matchingLayerVersions.LayerVersions ?? [];

    return matchingLayerVersions.LayerVersions.sort((layer1, layer2) => {
      return (layer1.Version ?? 0) - (layer2.Version ?? 0);
    });
  }

  @cache({
    namespace: `datasource-${AwsVersionedArnDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases({
    packageName: serializedArnFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const lambdaLayerVersions = await this.getSortedLambdaLayerVersions(
      serializedArnFilter
    );
    if (lambdaLayerVersions.length === 0) {
      return null;
    }

    return {
      releases: lambdaLayerVersions.map((layer) => ({
        version: layer.Version?.toString() ?? '0',
        releaseTimestamp: layer.CreatedDate,
        newDigest: layer.LayerVersionArn,
      })),
    };
  }
}
