import { AbstractMigration } from '../base/abstract-migration';

export class RequireConfigMigration extends AbstractMigration {
  override readonly propertyName = 'requireConfig';

  override run(value: unknown): void {
    if (value === true) {
      this.rewrite('required');
    }
    if (value === false) {
      this.rewrite('optional');
    }
  }
}
