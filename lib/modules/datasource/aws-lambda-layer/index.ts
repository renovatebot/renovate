import {
  LambdaClient,
  LayerVersionsListItem,
  ListLayerVersionsCommand,
} from '@aws-sdk/client-lambda';
import { cache } from '../../../util/cache/package/decorator';
import { Lazy } from '../../../util/lazy';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export interface AwsLambdaLayerFilter {
  name: string;
  runtime: string;
  architecture: string;
}

export class AwsLambdaLayerDataSource extends Datasource {
  static readonly id = 'aws-lambda-layer';

  override readonly caching = true;

  private readonly lambda: Lazy<LambdaClient>;

  constructor() {
    super(AwsLambdaLayerDataSource.id);
    this.lambda = new Lazy(() => new LambdaClient({}));
  }

  @cache({
    namespace: `datasource-${AwsLambdaLayerDataSource.id}`,
    key: (serializedLayerFilter: string) =>
      `getSortedLambdaLayerVersions:${serializedLayerFilter}`,
  })
  async getSortedLambdaLayerVersions(
    filter: AwsLambdaLayerFilter
  ): Promise<LayerVersionsListItem[]> {
    const cmd = new ListLayerVersionsCommand({
      LayerName: filter.name,
      CompatibleArchitecture: filter.architecture,
      CompatibleRuntime: filter.runtime,
    });

    const matchingLayerVersions = await this.lambda.getValue().send(cmd);

    return matchingLayerVersions.LayerVersions ?? [];
  }

  @cache({
    namespace: `datasource-${AwsLambdaLayerDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases({
    packageName: serializedLambdaLayerFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const filter: AwsLambdaLayerFilter = JSON.parse(
      serializedLambdaLayerFilter
    );

    const lambdaLayerVersions = await this.getSortedLambdaLayerVersions(filter);

    if (lambdaLayerVersions.length === 0) {
      return null;
    }

    return {
      releases: lambdaLayerVersions.map((layer) => ({
        version: layer.Version?.toString() ?? '0',
        releaseTimestamp: layer.CreatedDate,
        newDigest: layer.LayerVersionArn,
        isDeprecated: false,
      })),
    };
  }
}
