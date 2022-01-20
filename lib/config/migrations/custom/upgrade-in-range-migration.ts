import { AbstractMigration } from '../base/abstract-migration';

export class UpgradeInRangeMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'upgradeInRange';

  override run(value): void {
    if (value === true) {
      this.setSafely('rangeStrategy', 'bump');
    }
  }
}
