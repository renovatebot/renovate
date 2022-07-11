import { AbstractMigration } from '../base/abstract-migration';

export class BinarySourceMigration extends AbstractMigration {
  override readonly propertyName = 'binarySource';

  override run(value: unknown): void {
    if (value === 'auto') {
      this.rewrite('global');
    }
  }
}
