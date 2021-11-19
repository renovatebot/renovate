import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PinVersionsMigration extends AbstractMigration {
  readonly propertyName = 'pinVersions';

  override run(): void {
    const { pinVersions } = this.originalConfig;
    this.delete(this.propertyName);

    if (is.boolean(pinVersions)) {
      this.setSafely('rangeStrategy', pinVersions ? 'pin' : 'replace');
    }
  }
}
