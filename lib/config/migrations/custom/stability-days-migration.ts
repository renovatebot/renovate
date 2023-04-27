import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class StabilityDaysMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'stabilityDays';

  override run(value: unknown): void {
    if (is.integer(value)) {
      let newValue: null | string;
      switch (value) {
        case 0:
          newValue = null;
          break;
        case 1:
          newValue = '1 day';
          break;
        default:
          newValue = `${value} days`;
          break;
      }
      this.setSafely('minimumReleaseAge', newValue);
    }
  }
}
