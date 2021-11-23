import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class RenovateForkMigration extends AbstractMigration {
  readonly propertyName = 'renovateFork';

  override run(value): void {
    this.delete();

    if (is.boolean(value)) {
      this.setSafely('includeForks', value);
    }
  }
}
