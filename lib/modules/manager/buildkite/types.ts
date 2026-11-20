import type { PackageDependency } from '../types.ts';

export type KnownPluginExtractor = (
  config: unknown,
  registryAliases: Record<string, string>,
) => PackageDependency[];

export interface KnownPlugin {
  extract: KnownPluginExtractor;
  /** Set to `false` to record a plugin's shape without extracting it yet. Defaults to `true`. */
  enabled?: boolean;
  /**
   * The plugin's own config field(s) `extract` reads. Documentation only -
   * kept alongside `extract` so it can't drift unnoticed, and used to
   * generate the plugin table in readme.md.
   */
  fields: string[];
  /**
   * The dependency this plugin updates, when the image name itself is fixed
   * (not user-overridable) - only set for a plugin with no user-configurable
   * image-name field. Documentation only; omit when the image is entirely
   * free-form user config, even if it has a fallback default.
   */
  dependency?: string;
}
