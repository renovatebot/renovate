import { AbstractMigration } from '../base/abstract-migration.ts';

export class SeparateMajorReleasesMigration extends AbstractMigration {
  override readonly propertyName = 'separateMajorReleases';

  override run(value: boolean | undefined): void {
    this.setSafely('separateMajorMinor', value);
  }
}
