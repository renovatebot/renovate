import is from '@sindresorhus/is';
import type { RegExManager } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class RegexManagersMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'regexManagers';

  override run(value: unknown): void {
    if (is.array(value)) {
      this.setSafely('customManagers', value as RegExManager[]);
    }
  }
}
