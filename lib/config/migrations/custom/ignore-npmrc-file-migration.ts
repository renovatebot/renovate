import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class IgnoreNpmrcFileMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'ignoreNpmrcFile';

  override run(): void {
    const npmrc = this.get('npmrc');

    if (!is.string(npmrc)) {
      this.setHard('npmrc', '');
    }
  }
}
