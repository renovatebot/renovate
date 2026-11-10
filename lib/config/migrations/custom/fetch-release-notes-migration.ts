import { isBoolean } from '@sindresorhus/is';
import type { RenovateConfigFile } from '../../types.ts';
import { RenamePropertyMigration } from '../base/rename-property-migration.ts';

export class FetchReleaseNotesMigration extends RenamePropertyMigration {
  constructor(
    originalConfig: RenovateConfigFile,
    migratedConfig: RenovateConfigFile,
  ) {
    super(
      'fetchReleaseNotes',
      'fetchChangeLogs',
      originalConfig,
      migratedConfig,
    );
  }

  override run(value: unknown): void {
    let newValue: unknown = value;

    if (isBoolean(value)) {
      newValue = value ? 'pr' : 'off';
    }

    super.run(newValue);
  }
}
