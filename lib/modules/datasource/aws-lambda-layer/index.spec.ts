import type {
  LayerVersionsListItem,
  ListLayerVersionsCommandOutput} from '@aws-sdk/client-lambda';
import { LambdaClient, ListLayerVersionsCommand } from '@aws-sdk/client-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { getPkgReleases } from '..';
import { logger } from '../../../logger';
import { AwsLambdaLayerDataSource } from '.';

const datasource = AwsLambdaLayerDataSource.id;

/**
 * Testdata for mock implementation of LambdaClient
 * layer1 to layer3 from oldest to newest
 */
const layer1: LayerVersionsListItem = {
  Version: 1,
  CreatedDate: '2021-01-10T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:3',
};

const layer2: LayerVersionsListItem = {
  Version: 2,
  CreatedDate: '2021-02-05T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:2',
};

const layer3: LayerVersionsListItem = {
  Version: 3,
  CreatedDate: '2021-03-01T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:1',
};

const layerWithArchitecture: LayerVersionsListItem = {
  Version: 3,
  CreatedDate: '2021-03-01T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:1',
  CompatibleArchitectures: ['x86_64'],
};

const layerWithRuntime: LayerVersionsListItem = {
  Version: 3,
  CreatedDate: '2021-03-01T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:1',
  CompatibleRuntimes: ['python3.7'],
};

const mock3Layers: ListLayerVersionsCommandOutput = {
  LayerVersions: [layer1, layer2, layer3],
  $metadata: {},
};

const mock1Layer: ListLayerVersionsCommandOutput = {
  LayerVersions: [layer3],
  $metadata: {},
};

const mockEmpty: ListLayerVersionsCommandOutput = {
  LayerVersions: [],
  $metadata: {},
};

const mockLayerWithArchitecture: ListLayerVersionsCommandOutput = {
  LayerVersions: [layerWithArchitecture],
  $metadata: {},
};

const mockLayerWithRuntime: ListLayerVersionsCommandOutput = {
  LayerVersions: [layerWithRuntime],
  $metadata: {},
};

const lambdaClientMock = mockClient(LambdaClient);

function mockListLayerVersionsCommandOutput(
  result: ListLayerVersionsCommandOutput,
): void {
  lambdaClientMock.reset();
  lambdaClientMock.on(ListLayerVersionsCommand).resolves(result);
}

describe('modules/datasource/aws-lambda-layer/index', () => {
  describe('getSortedLambdaLayerVersions', () => {
    it('should warn about missing architecture in filter if AWS response contains architecture', async () => {
      mockListLayerVersionsCommandOutput(mockLayerWithArchitecture);
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();

      await lambdaLayerDatasource.getSortedLambdaLayerVersions(
        'arn',
        'runtime',
        undefined,
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'AWS returned layers with architecture but the architecture is not set in the filter. You might update to a layer with wrong architecture.',
      );
    });

    it('should warn about missing runtime in filter if AWS response contains runtime', async () => {
      mockListLayerVersionsCommandOutput(mockLayerWithRuntime);
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();

      await lambdaLayerDatasource.getSortedLambdaLayerVersions(
        'arn',
        undefined,
        'architecture',
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'AWS returned layers with runtime but the runtime is not set in the filter. You might update to a layer with wrong runtime.',
      );
    });

    it('should return empty array if no layers are found', async () => {
      mockListLayerVersionsCommandOutput(mockEmpty);
      const lamdbaLayerDatasource = new AwsLambdaLayerDataSource();
      const res = await lamdbaLayerDatasource.getSortedLambdaLayerVersions(
        'xy',
        'arm64',
        'python3.8',
      );

      expect(res).toEqual([]);
    });

    it('should return an empty array if AWS response does not contain LayerVersions', async () => {
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();
      lambdaClientMock.on(ListLayerVersionsCommand).resolves({
        $metadata: {},
      });

      const res = await lambdaLayerDatasource.getSortedLambdaLayerVersions(
        'xy',
        'arm64',
        'python3.8',
      );

      expect(res).toEqual([]);
    });

    it('should return array with one layer if one layer found', async () => {
      mockListLayerVersionsCommandOutput(mock1Layer);
      const lamdbaLayerDatasource = new AwsLambdaLayerDataSource();
      const res = await lamdbaLayerDatasource.getSortedLambdaLayerVersions(
        'not-relevant',
        'not-relevant',
        'not-relevant',
      );

      expect(res).toEqual([layer3]);
    });

    it('should return array with three layers if three layers found', async () => {
      mockListLayerVersionsCommandOutput(mock3Layers);
      const lamdbaLayerDatasource = new AwsLambdaLayerDataSource();
      const res = await lamdbaLayerDatasource.getSortedLambdaLayerVersions(
        'not-relevant',
        'not-relevant',
        'not-relevant',
      );

      expect(res).toEqual([layer1, layer2, layer3]);
    });

    it('should pass the filters for listLayerVersions when calling the AWS API', async () => {
      mockListLayerVersionsCommandOutput(mock3Layers);
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();

      await lambdaLayerDatasource.getSortedLambdaLayerVersions(
        'arn',
        'runtime',
        'architecture',
      );

      expect(lambdaClientMock.calls()).toHaveLength(1);

      expect(lambdaClientMock.calls()[0].args[0].input).toEqual({
        CompatibleArchitecture: 'architecture',
        CompatibleRuntime: 'runtime',
        LayerName: 'arn',
      });
    });

    it('should call AWS with no architecture if there is no architecture in the filter', async () => {
      mockListLayerVersionsCommandOutput(mock3Layers);
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();

      await lambdaLayerDatasource.getSortedLambdaLayerVersions(
        'arn',
        'runtime',
        undefined,
      );

      expect(lambdaClientMock.calls()).toHaveLength(1);

      expect(lambdaClientMock.calls()[0].args[0].input).toEqual({
        CompatibleArchitecture: undefined,
        CompatibleRuntime: 'runtime',
        LayerName: 'arn',
      });
    });

    it('should call AWS with no runtime if there is no runtime in the filter', async () => {
      mockListLayerVersionsCommandOutput(mock3Layers);
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();

      await lambdaLayerDatasource.getSortedLambdaLayerVersions(
        'arn',
        undefined,
        'python3.8',
      );

      expect(lambdaClientMock.calls()).toHaveLength(1);

      expect(lambdaClientMock.calls()[0].args[0].input).toEqual({
        CompatibleArchitecture: 'python3.8',
        CompatibleRuntime: undefined,
        LayerName: 'arn',
      });
    });
  });

  describe('getReleases', () => {
    it('should throw an exception if the filter criteria does not match the schema', async () => {
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();
      const res = lambdaLayerDatasource.getReleases({
        packageName: '{"invalid": "json"}',
      });

      await expect(res).rejects.toThrow();
    });

    it('should throw an exception if version is not set in AWS response', async () => {
      mockListLayerVersionsCommandOutput({
        LayerVersions: [
          {
            CreatedDate: '2021-01-10T00:00:00.000Z',
            LayerVersionArn:
              'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:3',
          },
        ],
        $metadata: {},
      });
      const lambdaLayerDatasource = new AwsLambdaLayerDataSource();

      await expect(() =>
        lambdaLayerDatasource.getReleases({
          packageName:
            '{"arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer", "runtime": "python37", "architecture": "x86_64"}',
        }),
      ).rejects.toThrow(
        'Version is not set in AWS response for ListLayerVersionsCommand',
      );
    });
  });

  describe('integration', () => {
    describe('getPkgReleases', () => {
      it('should return null if no releases found', async () => {
        mockListLayerVersionsCommandOutput(mockEmpty);

        const res = await getPkgReleases({
          datasource,
          packageName:
            '{"arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer", "runtime": "python37", "architecture": "x86_64"}',
        });

        expect(res).toBeNull();
      });

      it('should return one image', async () => {
        mockListLayerVersionsCommandOutput(mock1Layer);

        const res = await getPkgReleases({
          datasource,
          packageName:
            '{"arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer", "runtime": "python37", "architecture": "x86_64"}',
        });

        expect(res).toStrictEqual({
          releases: [
            {
              isDeprecated: false,
              version: layer3.Version?.toFixed(0),
              newDigest: layer3.LayerVersionArn,
              releaseTimestamp: layer3.CreatedDate,
            },
          ],
        });
      });

      it('should return 3 images', async () => {
        mockListLayerVersionsCommandOutput(mock3Layers);

        const res = await getPkgReleases({
          datasource,
          packageName:
            '{"arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer", "runtime": "python37", "architecture": "x86_64"}',
        });

        expect(res).toStrictEqual({
          releases: [
            {
              isDeprecated: false,
              version: layer1.Version?.toFixed(0),
              newDigest: layer1.LayerVersionArn,
              releaseTimestamp: layer1.CreatedDate,
            },
            {
              isDeprecated: false,
              version: layer2.Version?.toFixed(0),
              newDigest: layer2.LayerVersionArn,
              releaseTimestamp: layer2.CreatedDate,
            },
            {
              isDeprecated: false,
              version: layer3.Version?.toFixed(0),
              newDigest: layer3.LayerVersionArn,
              releaseTimestamp: layer3.CreatedDate,
            },
          ],
        });
      });
    });
  });
});
