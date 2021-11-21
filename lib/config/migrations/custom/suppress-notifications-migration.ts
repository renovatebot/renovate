import { AbstractMigration } from '../base/abstract-migration';

export class SuppressNotificationsMigration extends AbstractMigration {
  readonly propertyName = 'suppressNotifications';

  override run(value): void {
    if (Array.isArray(value)) {
      const newValue = value.filter((item) => item !== 'prEditNotification');
      this.rewrite(newValue);
    }
  }
}
