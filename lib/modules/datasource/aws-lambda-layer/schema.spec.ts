import { Fixtures } from '../../../../test/fixtures';
import { AwsLambdaLayerFilterMetadata } from './schema';

describe('modules/datasource/aws-lambda-layer/schema', () => {
  describe('AwsLambdaLayerFilterMetadata', () => {
    it('parses metadata', () => {
      const metadataJson = Fixtures.get('layer-filter-valid.json');
      const metadata = AwsLambdaLayerFilterMetadata.parse(JSON.parse(metadataJson));

      expect(metadata.architecture).toBe('x86_64');
      expect(metadata.name).toBe('aws-lambda-layer');
      expect(metadata.runtime).toBe('nodejs14.x');
    });
  });
});
