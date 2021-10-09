import type { RenovateConfig } from '../types';
import { ReplacePropertyMigration } from './base/replace-property-migration';

export class RequiredStatusChecksMigration extends ReplacePropertyMigration {
  constructor() {
    super('requiredStatusChecks', 'ignoreTests');
  }

  override run(config: RenovateConfig): RenovateConfig {
    return this.replaceProperty(
      config,
      config.requiredStatusChecks === null ? true : undefined
    );
  }
}
