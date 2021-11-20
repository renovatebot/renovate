import { AbstractMigration } from '../base/abstract-migration';

export class RaiseDeprecationWarningsMigration extends AbstractMigration {
  readonly propertyName = 'raiseDeprecationWarnings';

  override run(): void {
    const { raiseDeprecationWarnings, suppressNotifications } =
      this.originalConfig;
    this.delete(this.propertyName);

    if (raiseDeprecationWarnings === false) {
      this.migratedConfig.suppressNotifications = Array.isArray(
        suppressNotifications
      )
        ? suppressNotifications.concat(['deprecationWarningIssues'])
        : ['deprecationWarningIssues'];
    }
  }
}
