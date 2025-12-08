import { AbstractMigration } from '../base/abstract-migration';

export class UpdateLockFilesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'updateLockFiles';

  override run(value: unknown): void {
    if (value === false) {
      this.setSafely('skipArtifactsUpdate', true);
    }
  }
}
