import is from '@sindresorhus/is';
import type { FetchChangeLogsOptions } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class FetchReleaseNotesMigration extends AbstractMigration {
  override deprecated = true;
  override readonly propertyName = 'fetchReleaseNotes';

  readonly newPropertyName = 'fetchChangeLogs';

  override run(value: unknown): void {
    let newValue: FetchChangeLogsOptions | undefined;
    if (is.boolean(value)) {
      newValue = value ? 'pr' : 'off';
    } else if (value === 'off' || value === 'pr' || value === 'branch') {
      newValue = value;
    }

    this.setSafely(this.newPropertyName, newValue);
  }
}
