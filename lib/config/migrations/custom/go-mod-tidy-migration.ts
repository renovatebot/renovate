import { AbstractMigration } from '../base/abstract-migration';

export class GoModTidyMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'gomodTidy';

  override run(value: unknown): void {
    const postUpdateOptions = this.get('postUpdateOptions');

    if (value) {
      const newPostUpdateOptions = Array.isArray(postUpdateOptions)
        ? postUpdateOptions.concat(['gomodTidy'])
        : ['gomodTidy'];
      this.setHard('postUpdateOptions', newPostUpdateOptions);
    }
  }
}
