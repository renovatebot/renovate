import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class PlatformCommitMigration extends AbstractMigration {
  override readonly propertyName = 'platformCommit';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.rewrite(value ? 'enabled' : 'disabled');
    }
  }
}
