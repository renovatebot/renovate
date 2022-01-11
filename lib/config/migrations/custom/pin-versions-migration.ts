import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PinVersionsMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'pinVersions';

  override run(value): void {
    if (is.boolean(value)) {
      this.setSafely('rangeStrategy', value ? 'pin' : 'replace');
    }
  }
}
