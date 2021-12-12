import { AbstractMigration } from '../base/abstract-migration';

export class GoModTidyMigration extends AbstractMigration {
  readonly propertyName = 'gomodTidy';
  override readonly deprecated = true;

  override run(value): void {
    const postUpdateOptions = this.get('postUpdateOptions');

    if (value) {
      const newPostUpdateOptions = Array.isArray(postUpdateOptions)
        ? postUpdateOptions.concat(['gomodTidy'])
        : ['gomodTidy'];
      this.setHard('postUpdateOptions', newPostUpdateOptions);
    }
  }
}
