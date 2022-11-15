import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class CompatibilityMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'compatibility';

  override run(value: unknown): void {
    if (is.object(value)) {
      this.setSafely('constraints', value as Record<string, string>);
    }
  }
}
