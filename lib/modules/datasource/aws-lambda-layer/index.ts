import {
  type Architecture,
  LambdaClient,
  type LayerVersionsListItem,
  ListLayerVersionsCommand,
  type Runtime,
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

    let hasArchitecture = false;
    let hasRuntime = false;

    matchingLayerVersions.LayerVersions?.forEach((layer) => {
      if (layer.CompatibleArchitectures !== undefined) {
        hasArchitecture = true;
      }
      if (layer.CompatibleRuntimes !== undefined) {
        hasRuntime = true;
      }
    });

    if (hasArchitecture && architecture === undefined) {
      logger.warn(
        'AWS returned layers with architecture but the architecture is not set in the filter. You might update to a layer with wrong architecture.'
      );
    }
    if (hasRuntime && runtime === undefined) {
      logger.warn(
        'AWS returned layers with runtime but the runtime is not set in the filter. You might update to a layer with wrong runtime.'
      );
    }

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

    // istanbul ignore if - no idea how to test this branch
    if (err) {
      logger.error(
        { err },
        'unknown error while fetching lambda layer versions from AWS',
      );
      return null;
    }

    return val;
  }
}
