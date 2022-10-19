import { AbstractMigration } from '../base/abstract-migration';

export class RequireConfigMigration extends AbstractMigration {
  override readonly propertyName = 'requireConfig';

  override run(value: unknown): void {
    if (value === false || value === 'false') {
      this.rewrite('optional');
    } else if (value === true || value === 'true') {
      this.rewrite('required');
    }
  }
}
