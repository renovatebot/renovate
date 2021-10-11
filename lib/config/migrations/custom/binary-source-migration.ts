import type { RenovateConfig } from '../../types';
import { ReplacePropertyMigration } from '../base/replace-property-migration';

export class BinarySourceMigration extends ReplacePropertyMigration {
  constructor() {
    super('binarySource', 'binarySource');
  }

  protected override getNewValue(config: RenovateConfig): string | unknown {
    return config[this.deprecatedPropertyName] === 'auto'
      ? 'global'
      : config[this.deprecatedPropertyName];
  }
}
