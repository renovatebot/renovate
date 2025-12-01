import {
  isArray,
  isBoolean,
  isNonEmptyArray,
  isNonEmptyObject,
  isObject,
  isString,
} from '@sindresorhus/is';
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
export function migrateConfig(
  config: RenovateConfig,
  parentKey?: string,
): MigratedConfig {
  try {
    if (!optionTypes) {
      optionTypes = {};
      options.forEach((option) => {
        optionTypes[option.name] = option.type;
      });
    }
    const newConfig = MigrationsService.run(config, parentKey);
    const migratedConfig = clone(newConfig) as MigratedRenovateConfig;

    for (const [key, val] of Object.entries(newConfig)) {
      if (isString(val) && val.includes('{{baseDir}}')) {
        // @ts-expect-error -- TODO: fix me
        migratedConfig[key] = val.replace(
          regEx(/{{baseDir}}/g),
          '{{packageFileDir}}',
        );
      } else if (isString(val) && val.includes('{{lookupName}}')) {
        // @ts-expect-error -- TODO: fix me
        migratedConfig[key] = val.replace(
          regEx(/{{lookupName}}/g),
          '{{packageName}}',
        );
      } else if (isString(val) && val.includes('{{depNameShort}}')) {
        // @ts-expect-error -- TODO: fix me
        migratedConfig[key] = val.replace(
          regEx(/{{depNameShort}}/g),
          '{{depName}}',
        );
      } else if (isString(val) && val.startsWith('{{semanticPrefix}}')) {
        // @ts-expect-error -- TODO: fix me
        migratedConfig[key] = val.replace(
          '{{semanticPrefix}}',
          '{{#if semanticCommitType}}{{semanticCommitType}}{{#if semanticCommitScope}}({{semanticCommitScope}}){{/if}}: {{/if}}',
        );
      } else if (optionTypes[key] === 'object' && isBoolean(val)) {
        // @ts-expect-error -- TODO: fix me
        migratedConfig[key] = { enabled: val };
      } else if (optionTypes[key] === 'boolean') {
        if (val === 'true') {
          // @ts-expect-error -- TODO: fix me
          migratedConfig[key] = true;
        } else if (val === 'false') {
          // @ts-expect-error -- TODO: fix me
          migratedConfig[key] = false;
        }
      } else if (
        optionTypes[key] === 'string' &&
        isArray(val) &&
        val.length === 1
      ) {
        // @ts-expect-error -- TODO: fix me
        migratedConfig[key] = String(val[0]);
      } else if (isArray(val)) {
        // @ts-expect-error -- TODO: fix me
        if (isArray(migratedConfig?.[key])) {
          const newArray = [];
          // @ts-expect-error -- TODO: fix me
          for (const item of migratedConfig[key]) {
            if (isObject(item) && !isArray(item)) {
              const arrMigrate = migrateConfig(item as RenovateConfig);
              newArray.push(arrMigrate.migratedConfig);
            } else {
              newArray.push(item);
            }
          }
          // @ts-expect-error -- TODO: fix me
          migratedConfig[key] = newArray;
        }
      } else if (isObject(val)) {
        const subMigrate = migrateConfig(
          // @ts-expect-error -- TODO: fix me
          migratedConfig[key] as RenovateConfig,
          key,
        );
        if (subMigrate.isMigrated) {
          // @ts-expect-error -- TODO: fix me
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
      // @ts-expect-error -- TODO: fix me
      if (isString(migratedConfig[key])) {
        for (const [from, to] of Object.entries(migratedTemplates)) {
          // @ts-expect-error -- TODO: fix me
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
      // @ts-expect-error -- TODO: fix me
      if (isNonEmptyObject(migratedConfig[language])) {
        migratedConfig.packageRules ??= [];
        // @ts-expect-error -- TODO: fix me
        const currentContent = migratedConfig[language] as any;
        const packageRule = {
          matchCategories: [language],
          ...currentContent,
        };
        migratedConfig.packageRules.unshift(packageRule);
        // @ts-expect-error -- TODO: fix me
        delete migratedConfig[language];
      }
    }
    // Migrate nested packageRules
    if (isNonEmptyArray(migratedConfig.packageRules)) {
      const existingRules = migratedConfig.packageRules;
      migratedConfig.packageRules = [];
      for (const packageRule of existingRules) {
        // @ts-expect-error -- TODO: fix me
        if (isArray(packageRule.packageRules)) {
          logger.debug('Flattening nested packageRules');
          // merge each subrule and add to the parent list
          // @ts-expect-error -- TODO: fix me
          for (const subrule of packageRule.packageRules) {
            // TODO: fix types #22198
            const combinedRule = mergeChildConfig(
              packageRule,
              subrule as PackageRule,
            );
            // @ts-expect-error -- TODO: fix me
            delete combinedRule.packageRules;
            migratedConfig.packageRules.push(combinedRule);
          }
        } else {
          migratedConfig.packageRules.push(packageRule);
        }
      }
    }
    if (
      // @ts-expect-error -- TODO: fix me
      isNonEmptyObject(migratedConfig['pip-compile']) &&
      // @ts-expect-error -- TODO: fix me
      isNonEmptyArray(migratedConfig['pip-compile'].managerFilePatterns)
    ) {
      // @ts-expect-error -- TODO: fix me
      migratedConfig['pip-compile'].managerFilePatterns = migratedConfig[
        'pip-compile'
      ].managerFilePatterns.map((filePattern) => {
        const pattern = filePattern as string;
        if (pattern.endsWith('.in')) {
          return pattern.replace(/\.in$/, '.txt');
        }
        if (pattern.endsWith('.in/')) {
          return pattern.replace(/\.in\/$/, '.txt/');
        }
        return pattern.replace(/\.in\$\/$/, '.txt$/');
      });
    }
    // @ts-expect-error -- TODO: fix me
    if (isNonEmptyArray(migratedConfig.matchManagers)) {
      // @ts-expect-error -- TODO: fix me
      if (migratedConfig.matchManagers.includes('gradle-lite')) {
        // @ts-expect-error -- TODO: fix me
        if (!migratedConfig.matchManagers.includes('gradle')) {
          // @ts-expect-error -- TODO: fix me
          migratedConfig.matchManagers.push('gradle');
        }
        // @ts-expect-error -- TODO: fix me
        migratedConfig.matchManagers = migratedConfig.matchManagers.filter(
          // @ts-expect-error -- TODO: fix me
          (manager) => manager !== 'gradle-lite',
        );
      }
    }
    // @ts-expect-error -- TODO: fix me
    if (isNonEmptyObject(migratedConfig['gradle-lite'])) {
      migratedConfig.gradle = mergeChildConfig(
        migratedConfig.gradle ?? {},
        // @ts-expect-error -- TODO: fix me
        migratedConfig['gradle-lite'],
      );
    }
    // @ts-expect-error -- TODO: fix me
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
  } catch (err) {
    logger.debug({ config, err }, 'migrateConfig() error');
    throw err;
  }
}
