import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeMigration extends AbstractMigration {
  override readonly propertyName = 'automerge';

  override run(value: unknown): void {
    const patch = this.get('patch');
    const minor = this.get('minor');
    const major = this.get('major');

    const newPatch = is.object(patch) ? patch : {};
    const newMinor = is.object(minor) ? minor : {};
    const newMajor = is.object(major) ? major : {};

    switch (value) {
      case 'none':
        this.rewrite(false);
        break;
      case 'patch':
        this.delete();
        newPatch.automerge = true;
        newMinor.automerge = false;
        newMajor.automerge = false;
        this.setHard('patch', newPatch);
        this.setHard('minor', newMinor);
        this.setHard('major', newMajor);
        break;
      case 'minor':
        this.delete();
        newMinor.automerge = true;
        newMajor.automerge = false;
        this.setHard('minor', newMinor);
        this.setHard('major', newMajor);
        break;
      case 'any':
        this.rewrite(true);
    }
  }
}
