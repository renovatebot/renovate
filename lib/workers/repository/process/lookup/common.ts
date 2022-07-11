import type { LookupUpdateConfig } from './types';

export function mergeConfigConstraints(
  config: LookupUpdateConfig
): LookupUpdateConfig {
  if (config?.extractedConstraints) {
    config.constraints = {
      ...config.extractedConstraints,
      ...config.constraints,
    };
    delete config.extractedConstraints;
  }
  return config;
}
