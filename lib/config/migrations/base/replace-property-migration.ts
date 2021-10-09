import type { RenovateConfig } from '../../types';
import type { Migration } from '../migration';

export class ReplacePropertyMigration implements Migration {
  protected readonly deprecatedPropertyName: string;

  protected readonly newPropertyName: string;

  constructor(deprecatedPropertyName: string, newPropertyName: string) {
    this.deprecatedPropertyName = deprecatedPropertyName;
    this.newPropertyName = newPropertyName;
  }

  run(config: RenovateConfig): RenovateConfig {
    return this.replaceProperty(config, config[this.deprecatedPropertyName]);
  }

  protected replaceProperty(
    config: RenovateConfig,
    newValue?: unknown
  ): Record<string, unknown> {
    const migratedConfig: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (key === this.deprecatedPropertyName) {
        if (newValue !== undefined) {
          migratedConfig[this.newPropertyName] = newValue;
        }
      } else {
        migratedConfig[key] = value;
      }
    }

    return migratedConfig;
  }
}
