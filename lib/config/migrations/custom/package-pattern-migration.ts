import { AbstractMigration } from '../base/abstract-migration';

export class PackagePatternMigration extends AbstractMigration {
  readonly propertyName = 'packagePattern';

  override run(value): void {
    this.delete();
    this.setSafely('packagePatterns', [value]);
  }
}
