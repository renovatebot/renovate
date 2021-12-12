import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PinVersionsMigration extends AbstractMigration {
  readonly propertyName = 'pinVersions';
  override readonly deprecated = true;

  run(value): void {
    if (is.boolean(value)) {
      this.setSafely('rangeStrategy', value ? 'pin' : 'replace');
    }
  }
}
