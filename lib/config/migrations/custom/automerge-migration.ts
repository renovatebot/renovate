import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeMigration extends AbstractMigration {
  readonly propertyName = 'automerge';

  override run(value): void {
    const patch = this.get('patch') ?? {};
    const minor = this.get('minor') ?? {};
    const major = this.get('major') ?? {};

    switch (value) {
      case 'none':
        this.rewrite(false);
        break;
      case 'patch':
        this.delete();
        patch.automerge = true;
        minor.automerge = false;
        major.automerge = false;
        this.setHard('patch', patch);
        this.setHard('minor', minor);
        this.setHard('major', major);
        break;
      case 'minor':
        this.delete();
        minor.automerge = true;
        major.automerge = false;
        this.setHard('minor', minor);
        this.setHard('major', major);
        break;
      case 'any':
        this.rewrite(true);
    }
  }
}
