import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { logger } from '../logger';
import { clone } from '../util/clone';
import { regEx } from '../util/regex';
import { GlobalConfig } from './global';
import { MigrationsService } from './migrations';
import { getOptions } from './options';
import { removedPresets } from './presets/common';
import type {
  MigratedConfig,
  MigratedRenovateConfig,
  RenovateConfig,
  RenovateOptions,
} from './types';
import { mergeChildConfig } from './utils';

const options = getOptions();

let optionTypes: Record<string, RenovateOptions['type']>;

// Returns a migrated config
export function migrateConfig(
  config: RenovateConfig,
  // TODO: remove any type (#9611)
  parentKey?: string | any
): MigratedConfig {
  try {
    if (!optionTypes) {
      optionTypes = {};
      options.forEach((option) => {
        optionTypes[option.name] = option.type;
      });
    }
    const newConfig = MigrationsService.run(config);
    const migratedConfig = clone(newConfig) as MigratedRenovateConfig;
    const depTypes = [
      'dependencies',
      'devDependencies',
      'engines',
      'optionalDependencies',
      'peerDependencies',
    ];
    const { migratePresets } = GlobalConfig.get();
    for (const [key, val] of Object.entries(newConfig)) {
      if (key.startsWith('masterIssue')) {
        const newKey = key.replace('masterIssue', 'dependencyDashboard');
        migratedConfig[newKey] = val;
        if (optionTypes[newKey] === 'boolean' && val === 'true') {
          migratedConfig[newKey] = true;
        }
        delete migratedConfig[key];
      } else if (key === 'packageFiles' && is.array(val)) {
        const fileList = [];
        for (const packageFile of val) {
          if (is.object(packageFile) && !is.array(packageFile)) {
            fileList.push((packageFile as any).packageFile);
            if (Object.keys(packageFile).length > 1) {
              migratedConfig.packageRules = is.array(
                migratedConfig.packageRules
              )
                ? migratedConfig.packageRules
                : [];
              const payload = migrateConfig(
                packageFile as RenovateConfig,
                key
              ).migratedConfig;
              for (const subrule of payload.packageRules || []) {
                subrule.paths = [(packageFile as any).packageFile];
                migratedConfig.packageRules.push(subrule);
              }
              delete payload.packageFile;
              delete payload.packageRules;
              if (Object.keys(payload).length) {
                migratedConfig.packageRules.push({
                  ...payload,
                  paths: [(packageFile as any).packageFile],
                });
              }
            }
          } else {
            fileList.push(packageFile);
          }
        }
        migratedConfig.includePaths = fileList;
        delete migratedConfig.packageFiles;
      } else if (depTypes.includes(key)) {
        migratedConfig.packageRules = is.array(migratedConfig.packageRules)
          ? migratedConfig.packageRules
          : [];
        const depTypePackageRule = migrateConfig(
          val as RenovateConfig,
          key
        ).migratedConfig;
        depTypePackageRule.depTypeList = [key];
        delete depTypePackageRule.packageRules;
        migratedConfig.packageRules.push(depTypePackageRule);
        delete migratedConfig[key];
      } else if (is.string(val) && val.includes('{{baseDir}}')) {
        migratedConfig[key] = val.replace(
          regEx(/{{baseDir}}/g), // TODO #12071
          '{{packageFileDir}}'
        );
      } else if (is.string(val) && val.includes('{{depNameShort}}')) {
        migratedConfig[key] = val.replace(
          regEx(/{{depNameShort}}/g), // TODO #12071
          '{{depName}}'
        );
      } else if (key === 'ignoreNpmrcFile') {
        delete migratedConfig.ignoreNpmrcFile;
        if (!is.string(migratedConfig.npmrc)) {
          migratedConfig.npmrc = '';
        }
      } else if (
        key === 'branchPrefix' &&
        is.string(val) &&
        val.includes('{{')
      ) {
        const templateIndex = val.indexOf(`{{`);
        migratedConfig.branchPrefix = val.substring(0, templateIndex);
        migratedConfig.additionalBranchPrefix = val.substring(templateIndex);
      } else if (key === 'semanticPrefix' && is.string(val)) {
        delete migratedConfig.semanticPrefix;
        let [text] = val.split(':') as any; // TODO: fixme
        text = text.split('(');
        [migratedConfig.semanticCommitType] = text;
        if (text.length > 1) {
          [migratedConfig.semanticCommitScope] = text[1].split(')');
        } else {
          migratedConfig.semanticCommitScope = null;
        }
      } else if (
        key === 'extends' &&
        (is.array<string>(val) || is.string(val))
      ) {
        if (is.string(migratedConfig.extends)) {
          migratedConfig.extends = [migratedConfig.extends];
        }
        const presets = migratedConfig.extends;
        for (let i = 0; i < presets.length; i += 1) {
          const preset = presets[i];
          if (is.string(preset)) {
            let newPreset = removedPresets[preset];
            if (newPreset !== undefined) {
              presets[i] = newPreset;
            }
            newPreset = migratePresets?.[preset];
            if (newPreset !== undefined) {
              presets[i] = newPreset;
            }
          }
        }
        migratedConfig.extends = migratedConfig.extends.filter(Boolean);
      } else if (key === 'separateMajorReleases') {
        delete migratedConfig.separateMultipleMajor;
        migratedConfig.separateMajorMinor = val;
      } else if (is.string(val) && val.startsWith('{{semanticPrefix}}')) {
        migratedConfig[key] = val.replace(
          '{{semanticPrefix}}',
          '{{#if semanticCommitType}}{{semanticCommitType}}{{#if semanticCommitScope}}({{semanticCommitScope}}){{/if}}: {{/if}}'
        );
      } else if (key === 'depTypes' && is.array(val)) {
        val.forEach((depType) => {
          if (is.object(depType) && !is.array(depType)) {
            const depTypeName = (depType as any).depType;
            if (depTypeName) {
              migratedConfig.packageRules = is.array(
                migratedConfig.packageRules
              )
                ? migratedConfig.packageRules
                : [];
              const newPackageRule = migrateConfig(
                depType as RenovateConfig,
                key
              ).migratedConfig;
              delete newPackageRule.depType;
              newPackageRule.depTypeList = [depTypeName];
              migratedConfig.packageRules.push(newPackageRule);
            }
          }
        });
        delete migratedConfig.depTypes;
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
      } else if (key === 'node' && (val as RenovateConfig).enabled === true) {
        delete migratedConfig.node.enabled;
        migratedConfig.travis = migratedConfig.travis || {};
        migratedConfig.travis.enabled = true;
        if (Object.keys(migratedConfig.node).length) {
          const subMigrate = migrateConfig(migratedConfig.node, key);
          migratedConfig.node = subMigrate.migratedConfig;
        } else {
          delete migratedConfig.node;
        }
      } else if (is.array(val)) {
        if (is.array(migratedConfig?.[key])) {
          const newArray = [];
          for (const item of migratedConfig[key] as unknown[]) {
            if (is.object(item) && !is.array(item)) {
              const arrMigrate = migrateConfig(item as RenovateConfig, key);
              newArray.push(arrMigrate.migratedConfig);
            } else {
              newArray.push(item);
            }
          }
          migratedConfig[key] = newArray;
        }
      } else if (is.object(val)) {
        const subMigrate = migrateConfig(
          migratedConfig[key] as RenovateConfig,
          key
        );
        if (subMigrate.isMigrated) {
          migratedConfig[key] = subMigrate.migratedConfig;
        }
      } else if (key === 'azureAutoComplete' || key === 'gitLabAutomerge') {
        if (migratedConfig[key] !== undefined) {
          migratedConfig.platformAutomerge = migratedConfig[key];
        }
        delete migratedConfig[key];
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
            regEx(from, 'g'), // TODO #12071
            to
          );
        }
      }
    }
    if (is.array(migratedConfig.packageRules)) {
      const renameMap = {
        paths: 'matchPaths',
        languages: 'matchLanguages',
        baseBranchList: 'matchBaseBranches',
        managers: 'matchManagers',
        datasources: 'matchDatasources',
        depTypeList: 'matchDepTypes',
        packageNames: 'matchPackageNames',
        packagePatterns: 'matchPackagePatterns',
        sourceUrlPrefixes: 'matchSourceUrlPrefixes',
        updateTypes: 'matchUpdateTypes',
      };
      for (const packageRule of migratedConfig.packageRules) {
        for (const [oldKey, ruleVal] of Object.entries(packageRule)) {
          const newKey = renameMap[oldKey];
          if (newKey) {
            packageRule[newKey] = ruleVal;
            delete packageRule[oldKey];
          }
        }
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
            const combinedRule = mergeChildConfig(packageRule, subrule);
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
          (manager) => manager !== 'gradle-lite'
        );
      }
    }
    if (is.nonEmptyObject(migratedConfig['gradle-lite'])) {
      migratedConfig.gradle = mergeChildConfig(
        migratedConfig.gradle || {},
        migratedConfig['gradle-lite']
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
