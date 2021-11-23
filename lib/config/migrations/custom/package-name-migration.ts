import { AbstractMigration } from '../base/abstract-migration';

export class PackageNameMigration extends AbstractMigration {
  readonly propertyName = 'packageName';

  override run(value): void {
    this.delete();

    this.setSafely('packageNames', [value]);
  }
}
