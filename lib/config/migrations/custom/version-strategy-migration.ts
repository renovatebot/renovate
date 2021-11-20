import { AbstractMigration } from '../base/abstract-migration';

export class VersionStrategyMigration extends AbstractMigration {
  readonly propertyName = 'versionStrategy';

  override run(): void {
    const { versionStrategy } = this.originalConfig;
    this.delete(this.propertyName);

    if (versionStrategy === 'widen') {
      this.setSafely('rangeStrategy', 'widen');
    }
  }
}
