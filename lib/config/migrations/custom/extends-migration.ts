import is from '@sindresorhus/is';
import { GlobalConfig } from '../../global';
import { removedPresets } from '../../presets/common';
import { AbstractMigration } from '../base/abstract-migration';

export class ExtendsMigration extends AbstractMigration {
  override readonly propertyName = 'extends';

  override run(): void {
    const value = this.get('extends');
    let newPresets: string[] = [];

    if (is.string(value)) {
      newPresets = this.normalizePresets([value]);
    }

    if (Array.isArray(value)) {
      newPresets = this.normalizePresets(value);
    }

    this.rewrite(newPresets);
  }

  private normalizePresets(presets: string[]): string[] {
    return presets
      .filter(is.string)
      .map((preset) => this.normalizePreset(preset))
      .filter(is.nonEmptyString);
  }

  private normalizePreset(preset: string): string | null {
    const migratePresets = GlobalConfig.get('migratePresets');

    if (removedPresets[preset] !== undefined) {
      return removedPresets[preset];
    }

    if (migratePresets?.[preset] !== undefined) {
      return migratePresets?.[preset];
    }

    return preset;
  }
}
