import { Migration } from './migration';

export class RequiredStatusChecksMigration extends Migration {
  public migrate(): void {
    this.delete('requiredStatusChecks');

    if (this.originalConfig.requiredStatusChecks === null) {
      this.migratedConfig.ignoreTests = true;
    }
  }
}
