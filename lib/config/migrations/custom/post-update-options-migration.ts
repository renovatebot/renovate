import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PostUpdateOptionsMigration extends AbstractMigration {
  override readonly propertyName = 'postUpdateOptions';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value
        .filter(is.nonEmptyString)
        .filter((option) => option !== 'gomodNoMassage');

      this.rewrite(newValue);
    }
  }
}
