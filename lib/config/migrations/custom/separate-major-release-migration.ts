import { AbstractMigration } from '../base/abstract-migration';

export class SeparateMajorReleasesMigration extends AbstractMigration {
  override readonly propertyName = 'separateMajorReleases';

  override run(value: boolean | undefined): void {
    this.setSafely('separateMajorMinor', value);
  }
}
