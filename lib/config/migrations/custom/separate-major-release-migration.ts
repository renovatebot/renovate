import { AbstractMigration } from '../base/abstract-migration';

export class SeparateMajorReleasesMigration extends AbstractMigration {
  override readonly propertyName = 'separateMajorReleases';

  override run(value: unknown): void {
    this.setSafely('separateMajorMinor', value);
  }
}
