import { RenovateConfig } from '../types';
import { Migration } from './migration';

export class RequiredStatusChecksMigration extends Migration {
  public migrate(): RenovateConfig {
    this.delete('requiredStatusChecks');

    if (this.originalConfig.requiredStatusChecks === null) {
      this.migratedConfig.ignoreTests = true;
    }

    return this.migratedConfig;
  }
}
