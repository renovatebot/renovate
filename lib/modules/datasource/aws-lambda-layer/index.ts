import {
  type Architecture,
  LambdaClient,
  LayerVersionsListItem,
  ListLayerVersionsCommand, Runtime,
} from '@aws-sdk/client-lambda';
import { ZodError } from 'zod';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Lazy } from '../../../util/lazy';
import { Result } from '../../../util/result';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { AwsLambdaLayerFilterMetadata } from './schema';

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
    arn: string, runtime: string, architecture: string
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
  async getReleases({packageName: serializedLambdaLayerFilter}: GetReleasesConfig): Promise<ReleaseResult | null> {
    const result = Result.parse(JSON.parse(serializedLambdaLayerFilter), AwsLambdaLayerFilterMetadata)
      .transform(({arn, runtime, architecture}) => {
        return this.getSortedLambdaLayerVersions(arn, runtime, architecture);
      })
      .transform((layerVersions): ReleaseResult => {
        const res: ReleaseResult = { releases: [] };

        res.releases = layerVersions.map((layer) => ({
          version: layer.Version?.toString() ?? '0',
          releaseTimestamp: layer.CreatedDate,
          newDigest: layer.LayerVersionArn,
          isDeprecated: false,
        }))

        return res;
      });

    const {val, err} = await result.unwrap();

    if (err instanceof ZodError) {
      logger.debug({ err }, 'aws-lambda-layer: validation error');
      return null;
    }

    if (err) {
      this.handleGenericErrors(err);
    }

    return val
  }
}
