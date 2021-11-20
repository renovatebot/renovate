import { AbstractMigration } from '../base/abstract-migration';

export class UpgradeInRangeMigration extends AbstractMigration {
  readonly propertyName = 'upgradeInRange';

  override run(): void {
    const { upgradeInRange } = this.originalConfig;
    this.delete(this.propertyName);

    if (upgradeInRange === true) {
      this.setSafely('rangeStrategy', 'bump');
    }
  }
}
