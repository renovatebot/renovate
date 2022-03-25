import { AbstractMigration } from '../base/abstract-migration';

export class PackagePatternMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packagePattern';

  override run(value: unknown): void {
    this.setSafely('packagePatterns', [value]);
  }
}
