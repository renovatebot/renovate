import { AwsLambdaLayerFilterMetadata, FilterParser } from './schema';

describe('modules/datasource/aws-lambda-layer/schema', () => {
  describe('AwsLambdaLayerFilterMetadata', () => {
    it('parses metadata', () => {
      const metadataJson = '{\n' +
        '  "runtime": "nodejs14.x",\n' +
        '  "architecture": "x86_64",\n' +
        '  "arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer"\n' +
        '}';
      const metadata = AwsLambdaLayerFilterMetadata.parse(
        FilterParser.parse(metadataJson),
      );

      expect(metadata).toStrictEqual({
        architecture: 'x86_64',
        arn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer',
        runtime: 'nodejs14.x',
      });
    });

    it('has optional runtime attribute', () => {
      const metadataJson = '{\n' +
        '  "architecture": "x86_64",\n' +
        '  "arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer"\n' +
        '}';

      const metadata = AwsLambdaLayerFilterMetadata.parse(
        FilterParser.parse(metadataJson),
      );

      expect(metadata).toStrictEqual({
        architecture: 'x86_64',
        arn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer',
      });
    });

    it('has optional architecture attribute', () => {
      const metadataJson = '{\n' +
        '  "runtime": "nodejs14.x",\n' +
        '  "arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer"\n' +
        '}';
      const metadata = AwsLambdaLayerFilterMetadata.parse(
        FilterParser.parse(metadataJson),
      );

      expect(metadata).toStrictEqual({
        arn: 'arn:aws:lambda:us-east-1:123456789012:layer:my-layer',
        runtime: 'nodejs14.x',
      });
    });
  });
});
