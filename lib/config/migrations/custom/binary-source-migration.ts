import { AbstractMigration } from '../base/abstract-migration';

export class BinarySourceMigration extends AbstractMigration {
  readonly propertyName = 'binarySource';

  run(value): void {
    if (value === 'auto') {
      this.rewrite('global');
    }
  }
}
