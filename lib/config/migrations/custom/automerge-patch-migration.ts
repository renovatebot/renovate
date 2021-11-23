import { AbstractMigration } from '../base/abstract-migration';

export class AutomergePatchMigration extends AbstractMigration {
  readonly propertyName = 'automergePatch';

  override run(value): void {
    const patch = this.get('patch') ?? {};
    this.delete();

    patch.automerge = Boolean(value);
    this.setHard('patch', patch);
  }
}
