import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeMinorMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'automergeMinor';

  override run(value: unknown): void {
    const minor = this.get('minor');

    const newMinor = is.object(minor) ? minor : {};
    newMinor.automerge = Boolean(value);
    this.setHard('minor', newMinor);
  }
}
