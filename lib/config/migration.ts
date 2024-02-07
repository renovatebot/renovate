import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { logger } from '../logger';
import { clone } from '../util/clone';
import { regEx } from '../util/regex';
import { MigrationsService } from './migrations';
import { getOptions } from './options';
import type {
  MigratedConfig,
  MigratedRenovateConfig,
  PackageRule,
  RenovateConfig,
  RenovateOptions,
} from './types';
import { mergeChildConfig } from './utils';

const options = getOptions();
export function fixShortHours(input: string): string {
  return input.replace(regEx(/( \d?\d)((a|p)m)/g), '$1:00$2');
}

let optionTypes: Record<string, RenovateOptions['type']>;
// Returns a migrated config
export function migrateConfig(config: RenovateConfig): MigratedConfig {
  try {
    if (!optionTypes) {
      optionTypes = {};
      options.forEach((option) => {
        optionTypes[option.name] = option.type;
      });
    }
    const newConfig = MigrationsService.run(config);
    const migratedConfig = clone(newConfig) as MigratedRenovateConfig;

    for (const [key, val] of Object.entries(newConfig)) {
      if (is.string(val) && val.includes('{{baseDir}}')) {
        migratedConfig[key] = val.replace(
          regEx(/{{baseDir}}/g),
          '{{packageFileDir}}',
        );
      } else if (is.string(val) && val.includes('{{lookupName}}')) {
        migratedConfig[key] = val.replace(
          regEx(/{{lookupName}}/g),
          '{{packageName}}',
        );
      } else if (is.string(val) && val.includes('{{depNameShort}}')) {
        migratedConfig[key] = val.replace(
          regEx(/{{depNameShort}}/g),
          '{{depName}}',
        );
      } else if (is.string(val) && val.startsWith('{{semanticPrefix}}')) {
        migratedConfig[key] = val.replace(
          '{{semanticPrefix}}',
          '{{#if semanticCommitType}}{{semanticCommitType}}{{#if semanticCommitScope}}({{semanticCommitScope}}){{/if}}: {{/if}}',
        );
      } else if (optionTypes[key] === 'object' && is.boolean(val)) {
        migratedConfig[key] = { enabled: val };
      } else if (optionTypes[key] === 'boolean') {
        if (val === 'true') {
          migratedConfig[key] = true;
        } else if (val === 'false') {
          migratedConfig[key] = false;
        }
      } else if (
        optionTypes[key] === 'string' &&
        is.array(val) &&
        val.length === 1
      ) {
        migratedConfig[key] = String(val[0]);
      } else if (is.array(val)) {
        if (is.array(migratedConfig?.[key])) {
          const newArray = [];
          for (const item of migratedConfig[key] as unknown[]) {
            if (is.object(item) && !is.array(item)) {
              const arrMigrate = migrateConfig(item as RenovateConfig);
              newArray.push(arrMigrate.migratedConfig);
            } else {
              newArray.push(item);
            }
          }
          migratedConfig[key] = newArray;
        }
      } else if (is.object(val)) {
        const subMigrate = migrateConfig(migratedConfig[key] as RenovateConfig);
        if (subMigrate.isMigrated) {
          migratedConfig[key] = subMigrate.migratedConfig;
        }
      }

      const migratedTemplates = {
        fromVersion: 'currentVersion',
        newValueMajor: 'newMajor',
        newValueMinor: 'newMinor',
        newVersionMajor: 'newMajor',
        newVersionMinor: 'newMinor',
        toVersion: 'newVersion',
      };
      if (is.string(migratedConfig[key])) {
        for (const [from, to] of Object.entries(migratedTemplates)) {
          migratedConfig[key] = (migratedConfig[key] as string).replace(
            regEx(from, 'g'),
            to,
          );
        }
      }
    }
    const languages = [
      'docker',
      'dotnet',
      'golang',
      'java',
      'js',
      'node',
      'php',
      'python',
      'ruby',
      'rust',
    ];
    for (const language of languages) {
      if (is.nonEmptyObject(migratedConfig[language])) {
        migratedConfig.packageRules ??= [];
        const currentContent = migratedConfig[language] as any;
        const packageRule = {
          matchCategories: [language],
          ...currentContent,
        };
        migratedConfig.packageRules.unshift(packageRule);
        delete migratedConfig[language];
      }
    }
    // Migrate nested packageRules
    if (is.nonEmptyArray(migratedConfig.packageRules)) {
      const existingRules = migratedConfig.packageRules;
      migratedConfig.packageRules = [];
      for (const packageRule of existingRules) {
        if (is.array(packageRule.packageRules)) {
          logger.debug('Flattening nested packageRules');
          // merge each subrule and add to the parent list
          for (const subrule of packageRule.packageRules) {
            // TODO: fix types #22198
            const combinedRule = mergeChildConfig(
              packageRule,
              subrule as PackageRule,
            );
            delete combinedRule.packageRules;
            migratedConfig.packageRules.push(combinedRule);
          }
        } else {
          migratedConfig.packageRules.push(packageRule);
        }
      }
    }
    if (is.nonEmptyArray(migratedConfig.matchManagers)) {
      if (migratedConfig.matchManagers.includes('gradle-lite')) {
        if (!migratedConfig.matchManagers.includes('gradle')) {
          migratedConfig.matchManagers.push('gradle');
        }
        migratedConfig.matchManagers = migratedConfig.matchManagers.filter(
          (manager) => manager !== 'gradle-lite',
        );
      }
    }
    if (is.nonEmptyObject(migratedConfig['gradle-lite'])) {
      migratedConfig.gradle = mergeChildConfig(
        migratedConfig.gradle ?? {},
        migratedConfig['gradle-lite'],
      );
    }
    delete migratedConfig['gradle-lite'];
    const isMigrated = !dequal(config, migratedConfig);
    if (isMigrated) {
      // recursive call in case any migrated configs need further migrating
      return {
        isMigrated,
        migratedConfig: migrateConfig(migratedConfig).migratedConfig,
      };
    }
    return { isMigrated, migratedConfig };
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ config, err }, 'migrateConfig() error');
    throw err;
  }
}
