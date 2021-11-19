import { AbstractMigration } from '../base/abstract-migration';

export class GoModTidyMigration extends AbstractMigration {
  readonly propertyName = 'gomodTidy';

  override run(): void {
    const { gomodTidy, postUpdateOptions } = this.originalConfig;

    this.delete(this.propertyName);

    if (gomodTidy) {
      this.migratedConfig.postUpdateOptions ??= postUpdateOptions ?? [];
      this.migratedConfig.postUpdateOptions.push('gomodTidy');
    }
  }
}
