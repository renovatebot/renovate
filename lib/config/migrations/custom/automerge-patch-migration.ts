import { isObject } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AutomergePatchMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'automergePatch';

  override run(value: unknown): void {
    const patch = this.get('patch');

    const newPatch = isObject(patch) ? patch : {};
    newPatch.automerge = Boolean(value);
    this.setHard('patch', newPatch);
  }
}
