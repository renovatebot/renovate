import { AbstractMigration } from '../base/abstract-migration';

export class DryRunMigration extends AbstractMigration {
  override readonly propertyName = 'dryRun';

  override run(value: unknown): void {
    if (value === true) {
      this.rewrite('full');
    }
    if (value === false) {
      this.rewrite(null);
    }
  }
}
