import { AbstractMigration } from '../base/abstract-migration';

export class RaiseDeprecationWarningsMigration extends AbstractMigration {
  readonly propertyName = 'raiseDeprecationWarnings';

  override run(value): void {
    const suppressNotifications = this.get('suppressNotifications');
    this.delete(this.propertyName);

    if (value === false) {
      this.migratedConfig.suppressNotifications = Array.isArray(
        suppressNotifications
      )
        ? suppressNotifications.concat(['deprecationWarningIssues'])
        : ['deprecationWarningIssues'];
    }
  }
}
