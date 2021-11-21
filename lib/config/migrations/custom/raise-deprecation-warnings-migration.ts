import { AbstractMigration } from '../base/abstract-migration';

export class RaiseDeprecationWarningsMigration extends AbstractMigration {
  readonly propertyName = 'raiseDeprecationWarnings';

  override run(value): void {
    const suppressNotifications = this.get('suppressNotifications');
    this.delete(this.propertyName);

    if (value === false) {
      const newSuppressNotifications = Array.isArray(suppressNotifications)
        ? suppressNotifications.concat(['deprecationWarningIssues'])
        : ['deprecationWarningIssues'];

      this.setHard('suppressNotifications', newSuppressNotifications);
    }
  }
}
