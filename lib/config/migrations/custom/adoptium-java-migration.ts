import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class AdoptiumJavaMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'adoptium-java';

  override run(value: unknown): void {
    if (is.nonEmptyObject(value)) {
      this.setSafely('java-version', value);
    }
  }
}
