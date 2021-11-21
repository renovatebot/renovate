import { AbstractMigration } from '../base/abstract-migration';

export class VersionStrategyMigration extends AbstractMigration {
  readonly propertyName = 'versionStrategy';

  override run(value): void {
    this.delete(this.propertyName);

    if (value === 'widen') {
      this.setSafely('rangeStrategy', 'widen');
    }
  }
}
