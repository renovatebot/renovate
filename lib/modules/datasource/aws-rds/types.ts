import type { Filter } from '@aws-sdk/client-rds';

export interface AwsClientConfig {
  region?: string;
  profile?: string;
}

export type ParsedConfig = (Filter | AwsClientConfig)[];
