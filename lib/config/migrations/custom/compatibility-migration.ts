import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class CompatibilityMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'compatibility';

  override run(value): void {
    if (is.object(value)) {
      this.setSafely('constraints', value);
    }
  }
}
