import {
  awsBeanstalkDetector,
  awsEc2Detector,
  awsEcsDetector,
  awsEksDetector,
  awsLambdaDetector,
} from '@opentelemetry/resource-detector-aws';
import {
  azureAppServiceDetector,
  azureFunctionsDetector,
  azureVmDetector,
} from '@opentelemetry/resource-detector-azure';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import { gitHubDetector } from '@opentelemetry/resource-detector-github';
import { envDetector } from '@opentelemetry/resources';
import { getResourceDetectors } from './detectors.ts';

describe('instrumentation/detectors', () => {
  it.each`
    env
    ${{}}
    ${{ OTEL_NODE_RESOURCE_DETECTORS: 'all' }}
    ${{ RENOVATE_USE_CLOUD_METADATA_SERVICES: 'true' }}
  `('should return all detectors: %o', () => {
    expect(getResourceDetectors({})).toEqual([
      awsBeanstalkDetector,
      awsEc2Detector,
      awsEcsDetector,
      awsEksDetector,
      awsLambdaDetector,
      azureAppServiceDetector,
      azureFunctionsDetector,
      azureVmDetector,
      gcpDetector,
      gitHubDetector,
      envDetector,
    ]);
  });

  it('should disable all detectors', () => {
    expect(
      getResourceDetectors({ OTEL_NODE_RESOURCE_DETECTORS: 'none' }),
    ).toEqual([]);
  });

  it('should disable cloud detectors', () => {
    expect(
      getResourceDetectors({ RENOVATE_USE_CLOUD_METADATA_SERVICES: 'false' }),
    ).toEqual([envDetector]);
  });

  it('should enable selected detectors', () => {
    expect(
      getResourceDetectors({ OTEL_NODE_RESOURCE_DETECTORS: 'env,github' }),
    ).toEqual([gitHubDetector, envDetector]);
  });
});
