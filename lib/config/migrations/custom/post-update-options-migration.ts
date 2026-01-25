import { isNonEmptyString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class PostUpdateOptionsMigration extends AbstractMigration {
  override readonly propertyName = 'postUpdateOptions';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (Array.isArray(value)) {
      const newValue = value
        .filter(isNonEmptyString)
        .filter((option) => option !== 'gomodNoMassage');

      this.rewrite(newValue);
    }
  }
}
