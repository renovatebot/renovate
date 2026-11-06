import type { ExtractConfig } from '../types.ts';

/**
 * When a branch is updated, the upgrade config is passed back into extraction,
 * so these dependency fields may be present and identify the dependency being
 * updated.
 */
export interface KubernetesExtractConfig extends ExtractConfig {
  depName?: string;
  currentValue?: string;
  newValue?: string;
  digestManagedExternally?: boolean;
}
