import type { PostUpdateOption } from '../../allowed-values.generated.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class GoModTidyMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'gomodTidy';

  override run(value: unknown): void {
    const postUpdateOptions = this.get('postUpdateOptions');

    if (value) {
      const newPostUpdateOptions: PostUpdateOption[] = Array.isArray(
        postUpdateOptions,
      )
        ? postUpdateOptions.concat(['gomodTidy'])
        : ['gomodTidy'];
      this.setHard('postUpdateOptions', newPostUpdateOptions);
    }
  }
}
