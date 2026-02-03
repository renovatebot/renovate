import { isInteger } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class StabilityDaysMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'stabilityDays';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (isInteger(value)) {
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
