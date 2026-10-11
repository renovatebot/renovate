import type { PackageDependency } from '../types.ts';

export type KnownPluginExtractor = (
  config: unknown,
  registryAliases: Record<string, string>,
) => PackageDependency[];

export interface KnownPlugin {
  extract: KnownPluginExtractor;
  /** Set to `false` to record a plugin's shape without extracting it yet. Defaults to `true`. */
  enabled?: boolean;
}
