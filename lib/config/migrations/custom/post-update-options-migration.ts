import { isNonEmptyString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PostUpdateOptionsMigration extends AbstractMigration {
  override readonly propertyName = 'postUpdateOptions';

  override run(value: unknown): void {
    if (Array.isArray(value)) {
      const newValue = value
        .filter(isNonEmptyString)
        .filter((option) => option !== 'gomodNoMassage');

      this.rewrite(newValue);
    }
  }
}
