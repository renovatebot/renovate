import { AbstractMigration } from './abstract-migration';

export class RemovePropertyMigration extends AbstractMigration {
  override run(): void {
    this.delete(this.propertyName);
  }
}
