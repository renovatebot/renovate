import type { RenovateConfig } from '../../types';
import type { Migration } from '../migration';

export class DeprecatePropertyMigration implements Migration {
  private readonly deprecatedPropertyName: string;

  constructor(deprecatedPropertyName: string) {
    this.deprecatedPropertyName = deprecatedPropertyName;
  }

  run(config: RenovateConfig): RenovateConfig {
    // eslint-disable-next-line no-param-reassign
    delete config[this.deprecatedPropertyName];

    return config;
  }
}
