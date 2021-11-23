import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNpmrcFileMigration extends AbstractMigration {
  readonly propertyName = 'ignoreNpmrcFile';

  override run(value): void {
    const npmrc = this.get('npmrc');
    this.delete();

    if (!is.string(npmrc)) {
      this.setHard('npmrc', '');
    }
  }
}
