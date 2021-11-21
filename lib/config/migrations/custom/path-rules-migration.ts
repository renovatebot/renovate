import { AbstractMigration } from '../base/abstract-migration';

export class PathRulesMigration extends AbstractMigration {
  readonly propertyName = 'pathRules';

  override run(): void {
    const { pathRules } = this.originalConfig;
    const packageRules =
      this.migratedConfig.packageRules ?? this.originalConfig.packageRules;
    this.delete(this.propertyName);

    if (Array.isArray(pathRules)) {
      this.migratedConfig.packageRules = Array.isArray(packageRules)
        ? packageRules.concat(pathRules)
        : pathRules;
    }
  }
}
