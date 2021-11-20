import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class ComposerIgnorePlatformReqsMigration extends AbstractMigration {
  readonly propertyName = 'composerIgnorePlatformReqs';

  override run(): void {
    const { composerIgnorePlatformReqs } = this.originalConfig;

    if (is.boolean(composerIgnorePlatformReqs)) {
      this.migratedConfig.composerIgnorePlatformReqs =
        composerIgnorePlatformReqs ? [] : null;
    }
  }
}
