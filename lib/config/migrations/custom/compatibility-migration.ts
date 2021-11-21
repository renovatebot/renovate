import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class CompatibilityMigration extends AbstractMigration {
  readonly propertyName = 'compatibility';

  override run(): void {
    const { compatibility } = this.originalConfig;
    this.delete(this.propertyName);

    if (is.object(compatibility)) {
      this.setSafely('constraints', compatibility);
    }
  }
}
