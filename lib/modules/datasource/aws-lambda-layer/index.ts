import {
  type Architecture,
  LambdaClient,
  LayerVersionsListItem,
  ListLayerVersionsCommand,
  Runtime,
} from '@aws-sdk/client-lambda';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Lazy } from '../../../util/lazy';
import { Result } from '../../../util/result';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { AwsLambdaLayerFilterMetadata, FilterParser } from './schema';

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
    key: (arn: string, runtime: string, architecture: string) =>
      `sorted-versions:${arn}-${runtime}-${architecture}`,
  })
  async getSortedLambdaLayerVersions(
    arn: string,
    runtime: string | undefined,
    architecture: string | undefined,
  ): Promise<LayerVersionsListItem[]> {
    const cmd = new ListLayerVersionsCommand({
      LayerName: arn,
      CompatibleArchitecture: architecture as Architecture,
      CompatibleRuntime: runtime as Runtime,
    });

    const matchingLayerVersions = await this.lambda.getValue().send(cmd);

    return matchingLayerVersions.LayerVersions ?? [];
  }

  @cache({
    namespace: `datasource-${AwsLambdaLayerDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `get-release:${packageName}`,
  })
  async getReleases({
    packageName: serializedLambdaLayerFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const lambdaLayerFilter = FilterParser.parse(serializedLambdaLayerFilter);

    const result = Result.parse(lambdaLayerFilter, AwsLambdaLayerFilterMetadata)
      .transform(({ arn, runtime, architecture }) => {
        return this.getSortedLambdaLayerVersions(arn, runtime, architecture);
      })
      .transform((layerVersions): ReleaseResult => {
        const res: ReleaseResult = { releases: [] };

        res.releases = layerVersions.map((layer) => {
          if (layer.Version === undefined) {
            throw new Error(
              'Version is not set in AWS response for ListLayerVersionsCommand',
            );
          }

          return {
            version: layer.Version.toString(),
            releaseTimestamp: layer.CreatedDate,
            newDigest: layer.LayerVersionArn,
            isDeprecated: false,
          };
        });

        return res;
      });

    const { val, err } = await result.unwrap();

    if (err) {
      logger.debug({ err }, 'aws-lambda-layer: filter validation error');
      return null;
    }

    return val;
  }
}
