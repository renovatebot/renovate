import { AbstractMigration } from '../base/abstract-migration.ts';

export class DryRunMigration extends AbstractMigration {
  override readonly propertyName = 'dryRun';

  override run(value: unknown): void {
    // The string variants come from env and CLI parsing, which cannot coerce
    // booleans for an option whose type is `string`.
    if (value === true || value === 'true') {
      this.rewrite('full');
    }
    if (value === false || value === 'false' || value === 'null') {
      this.rewrite(null);
    }
  }
}
