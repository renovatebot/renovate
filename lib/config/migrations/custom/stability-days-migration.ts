import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class StabilityDaysMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'stabilityDays';

  override run(value: unknown): void {
    if (is.integer(value)) {
      this.setSafely(
        'minimumReleaseAge',
        value === 1 ? `${value} day` : `${value} days`
      );
    }
  }
}
