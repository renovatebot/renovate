import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class DotnetMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'dotnet';

  override run(value: unknown): void {
    if (is.nonEmptyObject(value)) {
      this.setSafely('dotnet-version', value);
    }
  }
}
