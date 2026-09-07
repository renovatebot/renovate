import { AbstractMigration } from '../base/abstract-migration.ts';

export class PlatformCommitMigration extends AbstractMigration {
  override readonly propertyName = 'platformCommit';

  override run(value: unknown): void {
    // The string variants come from env and CLI parsing, which cannot coerce
    // booleans for an option whose type is `string`.
    if (value === true || value === 'true') {
      this.rewrite('enabled');
    } else if (value === false || value === 'false') {
      this.rewrite('disabled');
    }
  }
}
