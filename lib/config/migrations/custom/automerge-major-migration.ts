import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeMajorMigration extends AbstractMigration {
  readonly propertyName = 'automergeMajor';

  override run(value): void {
    const major = this.get('major') ?? {};
    this.delete();

    major.automerge = Boolean(value);
    this.setHard('major', major);
  }
}
