import { AbstractMigration } from '../base/abstract-migration';

export class VersionStrategyMigration extends AbstractMigration {
  override readonly deprecated = true;
  readonly propertyName = 'versionStrategy';

  override run(value): void {
    if (value === 'widen') {
      this.setSafely('rangeStrategy', 'widen');
    }
  }
}
