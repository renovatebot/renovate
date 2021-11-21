import { AbstractMigration } from '../base/abstract-migration';

export class GoModTidyMigration extends AbstractMigration {
  readonly propertyName = 'gomodTidy';

  override run(value): void {
    const postUpdateOptions = this.get('postUpdateOptions');

    this.delete(this.propertyName);

    if (value) {
      this.migratedConfig.postUpdateOptions = Array.isArray(postUpdateOptions)
        ? postUpdateOptions.concat(['gomodTidy'])
        : ['gomodTidy'];
    }
  }
}
