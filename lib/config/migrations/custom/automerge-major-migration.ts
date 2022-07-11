import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AutomergeMajorMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'automergeMajor';

  override run(value: unknown): void {
    const major = this.get('major');

    const newMajor = is.object(major) ? major : {};
    newMajor.automerge = Boolean(value);
    this.setHard('major', newMajor);
  }
}
