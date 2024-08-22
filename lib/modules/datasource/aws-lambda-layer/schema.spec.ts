import { AwsLambdaLayerFilterMetadata } from './schema';

describe('modules/datasource/aws-lambda-layer/schema', () => {
  describe('AwsLambdaLayerFilterMetadata', () => {
    it('parses metadata', () => {
      const metadataJson = '{\n' +
        '  "runtime": "nodejs14.x",\n' +
        '  "architecture": "x86_64",\n' +
        '  "arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer"\n' +
        '}';
      const metadata = AwsLambdaLayerFilterMetadata.parse(
        JSON.parse(metadataJson),
      );

      expect(metadata.architecture).toBe('x86_64');
      expect(metadata.arn).toBe(
        'arn:aws:lambda:us-east-1:123456789012:layer:my-layer',
      );
      expect(metadata.runtime).toBe('nodejs14.x');
    });

    it('has optional runtime attribute', () => {
      const metadataJson = '{\n' +
        '  "architecture": "x86_64",\n' +
        '  "arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer"\n' +
        '}';

      const metadata = AwsLambdaLayerFilterMetadata.parse(
        JSON.parse(metadataJson),
      );

      expect(metadata.architecture).toBe('x86_64');
      expect(metadata.arn).toBe(
        'arn:aws:lambda:us-east-1:123456789012:layer:my-layer',
      );
      expect(metadata.runtime).toBeUndefined();
    });

    it('has optional architecture attribute', () => {
      const metadataJson = '{\n' +
        '  "runtime": "nodejs14.x",\n' +
        '  "arn": "arn:aws:lambda:us-east-1:123456789012:layer:my-layer"\n' +
        '}';
      const metadata = AwsLambdaLayerFilterMetadata.parse(
        JSON.parse(metadataJson),
      );

      expect(metadata.architecture).toBeUndefined();
      expect(metadata.arn).toBe(
        'arn:aws:lambda:us-east-1:123456789012:layer:my-layer',
      );
      expect(metadata.runtime).toBe('nodejs14.x');
    });
  });
});
