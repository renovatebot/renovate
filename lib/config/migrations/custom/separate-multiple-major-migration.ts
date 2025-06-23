import { AbstractMigration } from '../base/abstract-migration';

export class SeparateMultipleMajorMigration extends AbstractMigration {
  override readonly propertyName = 'separateMultipleMajor';

  override run(): void {
    if (this.has('separateMajorReleases')) {
      this.delete();
    }
  }
}
