import {
  LambdaClient,
  LayerVersionsListItem,
  ListLayerVersionsCommand,
  ListLayerVersionsCommandOutput,
} from '@aws-sdk/client-lambda';

import { mockClient } from 'aws-sdk-client-mock';
import { AwsVersionedArnDataSource } from './index';

/**
 * Testdata for mock implementation of LambdaClient
 * layer1 to layer3 from oldest to newest
 */
const layer1: LayerVersionsListItem = {
  Version: 1,
  CreatedDate: '2021-01-01T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:1',
};

const layer2: LayerVersionsListItem = {
  Version: 2,
  CreatedDate: '2021-02-01T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:2',
};

const layer3: LayerVersionsListItem = {
  Version: 3,
  CreatedDate: '2021-03-01T00:00:00.000Z',
  LayerVersionArn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer:3',
};

const mock3Layers: ListLayerVersionsCommandOutput = {
  LayerVersions: [layer3, layer2, layer1],
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

const lambdaClientMock = mockClient(LambdaClient);

function mockListLayerVersionsCommandOutput(
  result: ListLayerVersionsCommandOutput
): void {
  lambdaClientMock.reset();
  lambdaClientMock.on(ListLayerVersionsCommand).resolves(result);
}

describe('modules/datasource/aws-versioned-arn/index', () => {
  describe('getSortedLambdaLayerVersions', () => {
    it('should return empty array if no layers found', async () => {
      mockListLayerVersionsCommandOutput(mockEmpty);
      const lamdbaLayerDatasource = new AwsVersionedArnDataSource();
      const res = await lamdbaLayerDatasource.getSortedLambdaLayerVersions(
        'my-layer'
      );

      expect(res).toEqual([]);
      expect(lambdaClientMock.calls()).toHaveLength(1);
      expect(lambdaClientMock.calls()[0].args[0]).toBe('my-layer');
    });

    it('should return array with one layer if one layer found', async () => {
      mockListLayerVersionsCommandOutput(mock1Layer);
      const lamdbaLayerDatasource = new AwsVersionedArnDataSource();
      const res = await lamdbaLayerDatasource.getSortedLambdaLayerVersions(
        'my-layer'
      );

      expect(res).toEqual([layer3]);
      expect(lambdaClientMock.calls()).toHaveLength(1);
      expect(lambdaClientMock.calls()[0].args[0]).toBe('my-layer');
    });

    it('should return array with three layers if three layers found', async () => {
      mockListLayerVersionsCommandOutput(mock3Layers);
      const lamdbaLayerDatasource = new AwsVersionedArnDataSource();
      const res = await lamdbaLayerDatasource.getSortedLambdaLayerVersions(
        'my-layer'
      );

      expect(res).toEqual([layer3, layer2, layer1]);
      expect(lambdaClientMock.calls()).toHaveLength(1);
      expect(lambdaClientMock.calls()[0].args[0]).toBe('my-layer');
    });
  });
});
