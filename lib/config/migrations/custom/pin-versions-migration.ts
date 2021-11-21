import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PinVersionsMigration extends AbstractMigration {
  readonly propertyName = 'pinVersions';

  override run(value): void {
    this.delete(this.propertyName);

    if (is.boolean(value)) {
      this.setSafely('rangeStrategy', value ? 'pin' : 'replace');
    }
  }
}
