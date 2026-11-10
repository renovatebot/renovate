import type { ToolingConfig } from '../asdf/types.ts';
import type { PackageDependency } from '../types.ts';

export interface MiseRegistryData {
  meta: {
    version: string;
  };
  tools: Record<string, Record<string, string>>;
}

export interface MiseConfigType {
  /** True when config filename contains `.local.` (e.g. mise.local.toml) */
  isLocal: boolean;
  /** Environment name extracted from filename, e.g. 'test' for mise.test.toml */
  env?: string;
}

export type BackendToolingConfig = Omit<PackageDependency, 'depName'> &
  Required<
    | Pick<PackageDependency, 'packageName' | 'datasource'>
    | Pick<PackageDependency, 'packageName' | 'skipReason'>
  >;

export interface ToolingDefinition {
  config: ToolingConfig;
  misePluginUrl?: string;
}
