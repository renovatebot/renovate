import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../types';
import { RenamePropertyMigration } from '../base/rename-property-migration';

export class FetchReleaseNotesMigration extends RenamePropertyMigration {
  constructor(originalConfig: RenovateConfig, migratedConfig: RenovateConfig) {
    super(
      'fetchReleaseNotes',
      'fetchChangeLogs',
      originalConfig,
      migratedConfig,
    );
  }

  override run(value: unknown): void {
    let newValue: unknown = value;

    if (is.boolean(value)) {
      newValue = value ? 'pr' : 'off';
    }

    super.run(newValue);
  }
}
