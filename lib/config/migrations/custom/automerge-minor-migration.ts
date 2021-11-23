import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeMinorMigration extends AbstractMigration {
  readonly propertyName = 'automergeMinor';

  override run(value): void {
    const minor = this.get('minor');
    this.delete();

    const newMinor = minor || {};
    newMinor.automerge = Boolean(value);
    this.setHard('minor', newMinor);
  }
}
