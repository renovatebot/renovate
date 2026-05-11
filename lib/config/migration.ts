import {
  isArray,
  isBoolean,
  isNonEmptyArray,
  isNonEmptyObject,
  isObject,
  isString,
} from '@sindresorhus/is';
import { dequal } from 'dequal';
import { logger } from '../logger/index.ts';
import { clone } from '../util/clone.ts';
import { regEx } from '../util/regex.ts';
import { MigrationsService } from './migrations/index.ts';
import { getOptions } from './options/index.ts';
import type {
  MigratedConfig,
  MigratedRenovateConfig,
  PackageRule,
  RenovateConfig,
  RenovateOptions,
} from './types.ts';
import { mergeChildConfig } from './utils.ts';

const options = getOptions();
const migratedTemplates = {
  fromVersion: 'currentVersion',
  newValueMajor: 'newMajor',
  newValueMinor: 'newMinor',
  newVersionMajor: 'newMajor',
  newVersionMinor: 'newMinor',
  toVersion: 'newVersion',
} as const;
const regExpWithEscape = RegExp as RegExpConstructor & {
  escape(input: string): string;
};

export function fixShortHours(input: string): string {
  return input.replace(regEx(/( \d?\d)((a|p)m)/g), '$1:00$2');
}

function getMigratedValue<Key extends keyof MigratedRenovateConfig>(
  config: MigratedRenovateConfig,
  key: Key,
): MigratedRenovateConfig[Key] {
  return config[key];
}

function setMigratedValue<Key extends keyof MigratedRenovateConfig>(
  config: MigratedRenovateConfig,
  key: Key,
  value: MigratedRenovateConfig[Key],
): void {
  config[key] = value;
}

function replaceStandaloneTemplateIdentifier(
  input: string,
  from: string,
  to: string,
): string {
  return input.replace(
    regEx(`\\b${regExpWithEscape.escape(from)}\\b`, 'g'),
    to,
  );
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

    for (const [rawKey, val] of Object.entries(newConfig)) {
      const key = rawKey as keyof MigratedRenovateConfig;
      if (isString(val) && val.includes('{{baseDir}}')) {
        setMigratedValue(
          migratedConfig,
          key,
          val.replace(regEx(/{{baseDir}}/g), '{{packageFileDir}}'),
        );
      } else if (isString(val) && val.includes('{{lookupName}}')) {
        setMigratedValue(
          migratedConfig,
          key,
          val.replace(regEx(/{{lookupName}}/g), '{{packageName}}'),
        );
      } else if (isString(val) && val.includes('{{depNameShort}}')) {
        setMigratedValue(
          migratedConfig,
          key,
          val.replace(regEx(/{{depNameShort}}/g), '{{depName}}'),
        );
      } else if (isString(val) && val.startsWith('{{semanticPrefix}}')) {
        setMigratedValue(
          migratedConfig,
          key,
          val.replace(
            '{{semanticPrefix}}',
            '{{#if semanticCommitType}}{{semanticCommitType}}{{#if semanticCommitScope}}({{semanticCommitScope}}){{/if}}: {{/if}}',
          ),
        );
      } else if (optionTypes[key] === 'object' && isBoolean(val)) {
        setMigratedValue(migratedConfig, key, { enabled: val });
      } else if (optionTypes[key] === 'boolean') {
        if (val === 'true') {
          setMigratedValue(migratedConfig, key, true);
        } else if (val === 'false') {
          setMigratedValue(migratedConfig, key, false);
        }
      } else if (
        optionTypes[key] === 'string' &&
        isArray(val) &&
        val.length === 1
      ) {
        setMigratedValue(migratedConfig, key, String(val[0]));
      } else if (isArray(val)) {
        // v8 ignore else -- TODO: add test #40625
        const currentValue = getMigratedValue(migratedConfig, key);
        if (isArray(currentValue)) {
          const newArray = [];
          for (const item of currentValue) {
            if (isObject(item) && !isArray(item)) {
              const arrMigrate = migrateConfig(item as RenovateConfig);
              newArray.push(arrMigrate.migratedConfig);
            } else {
              newArray.push(item);
            }
          }
          setMigratedValue(migratedConfig, key, newArray);
        }
      } else if (isObject(val)) {
        const subMigrate = migrateConfig(
          getMigratedValue(migratedConfig, key) as RenovateConfig,
          key,
        );
        if (subMigrate.isMigrated) {
          setMigratedValue(migratedConfig, key, subMigrate.migratedConfig);
        }
      }

      const migratedValue = getMigratedValue(migratedConfig, key);
      if (isString(migratedValue)) {
        let migratedStringValue = migratedValue;
        for (const [from, to] of Object.entries(migratedTemplates)) {
          migratedStringValue = replaceStandaloneTemplateIdentifier(
            migratedStringValue,
            from,
            to,
          );
        }
        setMigratedValue(migratedConfig, key, migratedStringValue);
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
        // v8 ignore else -- TODO: add test #40625
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
