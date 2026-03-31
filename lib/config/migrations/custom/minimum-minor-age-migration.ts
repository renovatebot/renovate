import { isNullOrUndefined, isPlainObject, isString } from '@sindresorhus/is';
import type { MinimumReleaseAgeConfig } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class MinimumMinorAgeMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'minimumMinorAge';

  override run(value: unknown): void {
    if (isString(value)) {
      const existingMinimumReleaseAge = this.get('minimumReleaseAge');

      if (isString(existingMinimumReleaseAge)) {
        // Convert existing string + minimumMinorAge to object form
        this.setHard('minimumReleaseAge', {
          default: existingMinimumReleaseAge,
          delayMinor: value,
        } satisfies MinimumReleaseAgeConfig);
      } else if (isPlainObject(existingMinimumReleaseAge)) {
        // Merge into existing object form
        this.setHard('minimumReleaseAge', {
          ...existingMinimumReleaseAge,
          delayMinor: value,
        });
      } else if (isNullOrUndefined(existingMinimumReleaseAge)) {
        // No existing minimumReleaseAge, just set delayMinor
        this.setHard('minimumReleaseAge', {
          delayMinor: value,
        } satisfies MinimumReleaseAgeConfig);
      }
    }
  }
}
