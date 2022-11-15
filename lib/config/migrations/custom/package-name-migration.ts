import { AbstractMigration } from '../base/abstract-migration';

export class PackageNameMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packageName';

  override run(value: unknown): void {
    this.setSafely('packageNames', [value]);
  }
}
