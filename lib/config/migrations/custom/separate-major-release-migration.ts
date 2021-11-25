import { AbstractMigration } from '../base/abstract-migration';

export class SeparateMajorReleasesMigration extends AbstractMigration {
  readonly propertyName = 'separateMajorReleases';

  override run(value): void {
    this.delete('separateMultipleMajor');
    this.setSafely('separateMajorMinor', value);
  }
}
