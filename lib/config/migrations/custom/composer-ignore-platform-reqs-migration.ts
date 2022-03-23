import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class ComposerIgnorePlatformReqsMigration extends AbstractMigration {
  override readonly propertyName = 'composerIgnorePlatformReqs';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.rewrite(value ? [] : null);
    }
  }
}
