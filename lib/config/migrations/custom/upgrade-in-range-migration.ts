import { AbstractMigration } from '../base/abstract-migration';

export class UpgradeInRangeMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'upgradeInRange';

  override run(value: unknown): void {
    if (value === true) {
      this.setSafely('rangeStrategy', 'bump');
    }
  }
}
