import is from '@sindresorhus/is';
import { GlobalConfig } from '../../global';
import { removedPresets } from '../../presets/common';
import { AbstractMigration } from '../base/abstract-migration';

export class ExtendsMigration extends AbstractMigration {
  readonly propertyName = 'extends';

  override run(): void {
    let presets = this.get('extends');
    const { migratePresets } = GlobalConfig.get();

    if (is.string(presets)) {
      presets = [presets];
    }

    if (Array.isArray(presets)) {
      const newPresets = presets
        .map((preset) => {
          if (is.string(preset)) {
            if (removedPresets[preset] !== undefined) {
              return removedPresets[preset];
            }

            if (migratePresets?.[preset] !== undefined) {
              return migratePresets?.[preset];
            }
          }

          return preset;
        })
        .filter(Boolean);

      this.rewrite(newPresets);
    }
  }
}
