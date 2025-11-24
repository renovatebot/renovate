import { isNonEmptyArray } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class SuppressNotificationsMigration extends AbstractMigration {
  override readonly propertyName = 'suppressNotifications';

  override run(value: unknown): void {
    if (isNonEmptyArray(value) && value.includes('prEditNotification')) {
      const newValue = value.filter((item) => item !== 'prEditNotification');
      this.rewrite(newValue);
    }
  }
}
