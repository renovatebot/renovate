import { AbstractMigration } from '../base/abstract-migration.ts';

export class RequireConfigMigration extends AbstractMigration {
  override readonly propertyName = 'requireConfig';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (value === false || value === 'false') {
      this.rewrite('optional');
    } else if (value === true || value === 'true') {
      this.rewrite('required');
    }
  }
}
