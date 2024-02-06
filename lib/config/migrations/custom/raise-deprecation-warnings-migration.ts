import { AbstractMigration } from '../base/abstract-migration';

export class RaiseDeprecationWarningsMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'raiseDeprecationWarnings';

  override run(value: unknown): void {
    const suppressNotifications = this.get('suppressNotifications');

    if (value === false) {
      this.setHard(
        'suppressNotifications',
        Array.isArray(suppressNotifications)
          ? suppressNotifications.concat(['deprecationWarningIssues'])
          : ['deprecationWarningIssues'],
      );
    }
  }
}
