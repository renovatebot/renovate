import { AbstractMigration } from '../base/abstract-migration';

export class VersionStrategyMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'versionStrategy';

  override run(value: unknown): void {
    if (value === 'widen') {
      this.setSafely('rangeStrategy', 'widen');
    }
  }
}
