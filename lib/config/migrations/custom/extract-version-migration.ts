import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class ExtractVersionMigration extends AbstractMigration {
  override readonly propertyName = 'extractVersion';

  override run(value: unknown): void {
    // Only migrate if the value is a string (legacy format)
    if (is.string(value)) {
      // Convert string to array format [regex, template] where template is just the captured version
      // For legacy string format, we use the same regex and a simple template to preserve the version
      this.rewrite([value]);
    }
  }
}
