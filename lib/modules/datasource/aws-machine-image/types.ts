import type { Filter } from '@aws-sdk/client-ec2';

export interface AwsClientConfig {
  region?: string;
  profile?: string;
}

export type ParsedConfig = [Filter | AwsClientConfig];
