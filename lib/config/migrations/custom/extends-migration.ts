import { isNonEmptyString, isString } from '@sindresorhus/is';
import { GlobalConfig } from '../../global';
import { removedPresets } from '../../presets/common';
import { AbstractMigration } from '../base/abstract-migration';

export class ExtendsMigration extends AbstractMigration {
  override readonly propertyName = 'extends';

  override run(): void {
    const value = this.get('extends');
    let newPresets: string[] = [];

    if (isString(value)) {
      newPresets = this.normalizePresets([value]);
    }

    if (Array.isArray(value)) {
      newPresets = this.normalizePresets(value);
    }

    this.rewrite(newPresets);
  }

  private normalizePresets(presets: string[]): string[] {
    return presets
      .filter(isString)
      .map((preset) => this.normalizePreset(preset))
      .filter(isNonEmptyString);
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
