import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PinVersionsMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'pinVersions';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.setSafely('rangeStrategy', value ? 'pin' : 'replace');
    }
  }
}
