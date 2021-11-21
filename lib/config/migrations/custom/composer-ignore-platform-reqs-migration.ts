import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class ComposerIgnorePlatformReqsMigration extends AbstractMigration {
  readonly propertyName = 'composerIgnorePlatformReqs';

  override run(value): void {
    if (is.boolean(value)) {
      this.migratedConfig.composerIgnorePlatformReqs = value ? [] : null;
    }
  }
}
