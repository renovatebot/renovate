import { AbstractMigration } from '../base/abstract-migration';

export class UpgradeInRangeMigration extends AbstractMigration {
  readonly propertyName = 'upgradeInRange';

  override run(value): void {
    this.delete();

    if (value === true) {
      this.setSafely('rangeStrategy', 'bump');
    }
  }
}
