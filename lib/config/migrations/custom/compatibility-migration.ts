import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class CompatibilityMigration extends AbstractMigration {
  readonly propertyName = 'compatibility';

  override run(value): void {
    this.delete();

    if (is.object(value)) {
      this.setSafely('constraints', value);
    }
  }
}
