import { AbstractMigration } from '../base/abstract-migration';

export class PackagePatternMigration extends AbstractMigration {
  readonly propertyName = 'packagePattern';

  override run(value): void {
    this.setSafely('packagePatterns', [value]);
  }
}
