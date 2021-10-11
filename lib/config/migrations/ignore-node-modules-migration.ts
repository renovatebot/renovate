import type { RenovateConfig } from '../types';
import { ReplacePropertyMigration } from './base/replace-property-migration';

export class IgnoreNodeModulesMigration extends ReplacePropertyMigration {
  constructor() {
    super('ignoreNodeModules', 'ignorePaths');
  }

  protected override getNewValue(config: RenovateConfig): string[] {
    return config[this.deprecatedPropertyName] ? ['node_modules/'] : [];
  }
}
