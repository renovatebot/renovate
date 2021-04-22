import later from '@breejs/later';
import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { logger } from '../logger';
import type { HostRule } from '../types';
import { clone } from '../util/clone';
import { getOptions } from './definitions';
import { removedPresets } from './presets/common';
import type { PackageRule, RenovateConfig, RenovateOptions } from './types';
import { mergeChildConfig } from './utils';

const options = getOptions();

let optionTypes: Record<string, RenovateOptions['type']>;

const removedOptions = [
  'maintainYarnLock',
  'yarnCacheFolder',
  'yarnMaintenanceBranchName',
  'yarnMaintenanceCommitMessage',
  'yarnMaintenancePrTitle',
  'yarnMaintenancePrBody',
  'groupBranchName',
  'groupBranchName',
  'groupCommitMessage',
  'groupPrTitle',
  'groupPrBody',
  'statusCheckVerify',
  'lazyGrouping',
];

export interface MigratedConfig {
  isMigrated: boolean;
  migratedConfig: RenovateConfig;
}

interface MigratedRenovateConfig extends RenovateConfig {
  endpoints?: HostRule[];
  pathRules: PackageRule[];
  packages: PackageRule[];

  node?: RenovateConfig;
  travis?: RenovateConfig;
}

// Returns a migrated config
export function migrateConfig(
  config: RenovateConfig,
  // TODO: remove any type
  parentKey?: string | any
): MigratedConfig {
  try {
    if (!optionTypes) {
      optionTypes = {};
      options.forEach((option) => {
        optionTypes[option.name] = option.type;
      });
    }
    const migratedConfig = clone(config) as MigratedRenovateConfig;
    const depTypes = [
      'dependencies',
      'devDependencies',
      'engines',
      'optionalDependencies',
      'peerDependencies',
    ];
    for (const [key, val] of Object.entries(config)) {
      if (removedOptions.includes(key)) {
        delete migratedConfig[key];
      } else if (key === 'pathRules') {
        if (is.array(val)) {
          migratedConfig.packageRules = is.array(migratedConfig.packageRules)
            ? migratedConfig.packageRules
            : [];
          migratedConfig.packageRules = val.concat(migratedConfig.packageRules);
        }
        delete migratedConfig.pathRules;
      } else if (key === 'suppressNotifications') {
        if (is.nonEmptyArray(val) && val.includes('prEditNotification')) {
          migratedConfig.suppressNotifications = migratedConfig.suppressNotifications.filter(
            (item) => item !== 'prEditNotification'
          );
        }
      } else if (key.startsWith('masterIssue')) {
        const newKey = key.replace('masterIssue', 'dependencyDashboard');
        migratedConfig[newKey] = val;
        if (optionTypes[newKey] === 'boolean' && val === 'true') {
          migratedConfig[newKey] = true;
        }
        delete migratedConfig[key];
      } else if (key === 'gomodTidy') {
        if (val) {
          migratedConfig.postUpdateOptions =
            migratedConfig.postUpdateOptions || [];
          migratedConfig.postUpdateOptions.push('gomodTidy');
        }
        delete migratedConfig.gomodTidy;
      } else if (key === 'semanticCommits') {
        if (val === true) {
          migratedConfig.semanticCommits = 'enabled';
        } else if (val === false) {
          migratedConfig.semanticCommits = 'disabled';
        } else if (val !== 'enabled' && val !== 'disabled') {
          migratedConfig.semanticCommits = 'auto';
        }
      } else if (parentKey === 'hostRules' && key === 'platform') {
        migratedConfig.hostType = val;
        delete migratedConfig.platform;
      } else if (parentKey === 'hostRules' && key === 'endpoint') {
        migratedConfig.baseUrl = val;
        delete migratedConfig.endpoint;
      } else if (parentKey === 'hostRules' && key === 'host') {
        migratedConfig.hostName = val;
        delete migratedConfig.host;
      } else if (key === 'packageRules' && is.plainObject(val)) {
        migratedConfig.packageRules = is.array(migratedConfig.packageRules)
          ? migratedConfig.packageRules
          : [];
        migratedConfig.packageRules.push(val);
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
              const payload = migrateConfig(packageFile as RenovateConfig, key)
                .migratedConfig;
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
        const depTypePackageRule = migrateConfig(val as RenovateConfig, key)
          .migratedConfig;
        depTypePackageRule.depTypeList = [key];
        delete depTypePackageRule.packageRules;
        migratedConfig.packageRules.push(depTypePackageRule);
        delete migratedConfig[key];
      } else if (key === 'pinVersions') {
        delete migratedConfig.pinVersions;
        if (val === true) {
          migratedConfig.rangeStrategy = 'pin';
        } else if (val === false) {
          migratedConfig.rangeStrategy = 'replace';
        }
      } else if (is.string(val) && val.includes('{{baseDir}}')) {
        migratedConfig[key] = val.replace(/{{baseDir}}/g, '{{packageFileDir}}');
      } else if (is.string(val) && val.includes('{{depNameShort}}')) {
        migratedConfig[key] = val.replace(/{{depNameShort}}/g, '{{depName}}');
      } else if (key === 'gitFs') {
        delete migratedConfig.gitFs;
      } else if (key === 'rebaseStalePrs') {
        delete migratedConfig.rebaseStalePrs;
        if (!migratedConfig.rebaseWhen) {
          if (val === null) {
            migratedConfig.rebaseWhen = 'auto';
          }
          if (val === true) {
            migratedConfig.rebaseWhen = 'behind-base-branch';
          }
          if (val === false) {
            migratedConfig.rebaseWhen = 'conflicted';
          }
        }
      } else if (key === 'rebaseConflictedPrs') {
        delete migratedConfig.rebaseConflictedPrs;
        if (val === false) {
          migratedConfig.rebaseWhen = 'never';
        }
      } else if (key === 'exposeEnv') {
        migratedConfig.exposeAllEnv = val;
        delete migratedConfig.exposeEnv;
      } else if (key === 'trustLevel') {
        delete migratedConfig.trustLevel;
        if (val === 'high') {
          migratedConfig.allowCustomCrateRegistries ??= true;
          migratedConfig.allowScripts ??= true;
          migratedConfig.exposeAllEnv ??= true;
        }
      } else if (key === 'ignoreNpmrcFile') {
        delete migratedConfig.ignoreNpmrcFile;
        if (!is.string(migratedConfig.npmrc)) {
          migratedConfig.npmrc = '';
        }
      } else if (
        key === 'branchName' &&
        is.string(val) &&
        val?.includes('{{managerBranchPrefix}}')
      ) {
        migratedConfig.branchName = val.replace(
          '{{managerBranchPrefix}}',
          '{{additionalBranchPrefix}}'
        );
      } else if (key === 'managerBranchPrefix') {
        delete migratedConfig.managerBranchPrefix;
        migratedConfig.additionalBranchPrefix = val;
      } else if (
        key === 'branchPrefix' &&
        is.string(val) &&
        val.includes('{{')
      ) {
        const templateIndex = val.indexOf(`{{`);
        migratedConfig.branchPrefix = val.substring(0, templateIndex);
        migratedConfig.additionalBranchPrefix = val.substring(templateIndex);
      } else if (key === 'upgradeInRange') {
        delete migratedConfig.upgradeInRange;
        if (val === true) {
          migratedConfig.rangeStrategy = 'bump';
        }
      } else if (key === 'versionStrategy') {
        delete migratedConfig.versionStrategy;
        if (val === 'widen') {
          migratedConfig.rangeStrategy = 'widen';
        }
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
            const newPreset = removedPresets[preset];
            if (newPreset !== undefined) {
              presets[i] = newPreset;
            }
          }
        }
        migratedConfig.extends = migratedConfig.extends.filter(Boolean);
      } else if (key === 'unpublishSafe') {
        if (val === true) {
          migratedConfig.extends = migratedConfig.extends || [];
          if (is.string(migratedConfig.extends)) {
            migratedConfig.extends = [migratedConfig.extends];
          }
          if (
            ![
              ':unpublishSafe',
              'default:unpublishSafe',
              'npm:unpublishSafe',
            ].some((x) => migratedConfig.extends.includes(x))
          ) {
            migratedConfig.extends.push('npm:unpublishSafe');
          }
        }
        delete migratedConfig.unpublishSafe;
      } else if (key === 'versionScheme') {
        migratedConfig.versioning = val;
        delete migratedConfig.versionScheme;
      } else if (
        key === 'automergeType' &&
        is.string(val) &&
        val.startsWith('branch-')
      ) {
        migratedConfig.automergeType = 'branch';
      } else if (key === 'automergeMinor') {
        migratedConfig.minor = migratedConfig.minor || {};
        migratedConfig.minor.automerge = val == true; // eslint-disable-line eqeqeq
        delete migratedConfig[key];
      } else if (key === 'automergeMajor') {
        migratedConfig.major = migratedConfig.major || {};
        migratedConfig.major.automerge = val == true; // eslint-disable-line eqeqeq
        delete migratedConfig[key];
      } else if (key === 'multipleMajorPrs') {
        delete migratedConfig.multipleMajorPrs;
        migratedConfig.separateMultipleMajor = val;
      } else if (key === 'renovateFork' && is.boolean(val)) {
        delete migratedConfig.renovateFork;
        migratedConfig.includeForks = val;
      } else if (key === 'separateMajorReleases') {
        delete migratedConfig.separateMultipleMajor;
        migratedConfig.separateMajorMinor = val;
      } else if (key === 'separatePatchReleases') {
        delete migratedConfig.separatePatchReleases;
        migratedConfig.separateMinorPatch = val;
      } else if (key === 'automergePatch') {
        migratedConfig.patch = migratedConfig.patch || {};
        migratedConfig.patch.automerge = val == true; // eslint-disable-line eqeqeq
        delete migratedConfig[key];
      } else if (key === 'ignoreNodeModules') {
        delete migratedConfig.ignoreNodeModules;
        migratedConfig.ignorePaths = val ? ['node_modules/'] : [];
      } else if (
        key === 'automerge' &&
        is.string(val) &&
        ['none', 'patch', 'minor', 'any'].includes(val)
      ) {
        delete migratedConfig.automerge;
        if (val === 'none') {
          migratedConfig.automerge = false;
        } else if (val === 'patch') {
          migratedConfig.patch = migratedConfig.patch || {};
          migratedConfig.patch.automerge = true;
          migratedConfig.minor = migratedConfig.minor || {};
          migratedConfig.minor.automerge = false;
          migratedConfig.major = migratedConfig.major || {};
          migratedConfig.major.automerge = false;
        } else if (val === 'minor') {
          migratedConfig.minor = migratedConfig.minor || {};
          migratedConfig.minor.automerge = true;
          migratedConfig.major = migratedConfig.major || {};
          migratedConfig.major.automerge = false;
        } /* istanbul ignore else: we can never go to else */ else if (
          val === 'any'
        ) {
          migratedConfig.automerge = true;
        }
      } else if (key === 'packages') {
        migratedConfig.packageRules = is.array(migratedConfig.packageRules)
          ? migratedConfig.packageRules
          : [];
        migratedConfig.packageRules = migratedConfig.packageRules.concat(
          migratedConfig.packages
        );
        delete migratedConfig.packages;
      } else if (key === 'excludedPackageNames') {
        migratedConfig.excludePackageNames = val;
        delete migratedConfig.excludedPackageNames;
      } else if (key === 'packageName') {
        migratedConfig.packageNames = [val];
        delete migratedConfig.packageName;
      } else if (key === 'packagePattern') {
        migratedConfig.packagePatterns = [val];
        delete migratedConfig.packagePattern;
      } else if (key === 'baseBranch') {
        migratedConfig.baseBranches = (is.array(val) ? val : [val]) as string[];
        delete migratedConfig.baseBranch;
      } else if (key === 'schedule' && val) {
        // massage to array first
        const schedules = is.string(val) ? [val] : [...(val as string[])];
        // split 'and'
        const schedulesLength = schedules.length;
        for (let i = 0; i < schedulesLength; i += 1) {
          if (
            schedules[i].includes(' and ') &&
            schedules[i].includes('before ') &&
            schedules[i].includes('after ')
          ) {
            const parsedSchedule = later.parse.text(
              // We need to massage short hours first before we can parse it
              schedules[i].replace(/( \d?\d)((a|p)m)/g, '$1:00$2')
            ).schedules[0];
            // Only migrate if the after time is greater than before, e.g. "after 10pm and before 5am"
            if (parsedSchedule?.t_a?.[0] > parsedSchedule?.t_b?.[0]) {
              const toSplit = schedules[i];
              schedules[i] = toSplit
                .replace(
                  /^(.*?)(after|before) (.*?) and (after|before) (.*?)( |$)(.*)/,
                  '$1$2 $3 $7'
                )
                .trim();
              schedules.push(
                toSplit
                  .replace(
                    /^(.*?)(after|before) (.*?) and (after|before) (.*?)( |$)(.*)/,
                    '$1$4 $5 $7'
                  )
                  .trim()
              );
            }
          }
        }
        for (let i = 0; i < schedules.length; i += 1) {
          if (schedules[i].includes('on the last day of the month')) {
            schedules[i] = schedules[i].replace(
              'on the last day of the month',
              'on the first day of the month'
            );
          }
          if (schedules[i].includes('on every weekday')) {
            schedules[i] = schedules[i].replace(
              'on every weekday',
              'every weekday'
            );
          }
          if (schedules[i].endsWith(' every day')) {
            schedules[i] = schedules[i].replace(' every day', '');
          }
          if (
            /every (mon|tues|wednes|thurs|fri|satur|sun)day$/.test(schedules[i])
          ) {
            schedules[i] = schedules[i].replace(/every ([a-z]*day)$/, 'on $1');
          }
          if (schedules[i].endsWith('days')) {
            schedules[i] = schedules[i].replace('days', 'day');
          }
        }
        if (is.string(val) && schedules.length === 1) {
          [migratedConfig.schedule] = schedules as any; // TODO: fixme
        } else {
          migratedConfig.schedule = schedules;
        }
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
      } else if (key === 'compatibility' && is.object(val)) {
        migratedConfig.constraints = migratedConfig.compatibility;
        delete migratedConfig.compatibility;
      } else if (is.object(val)) {
        const subMigrate = migrateConfig(
          migratedConfig[key] as RenovateConfig,
          key
        );
        if (subMigrate.isMigrated) {
          migratedConfig[key] = subMigrate.migratedConfig;
        }
      } else if (key === 'raiseDeprecationWarnings') {
        delete migratedConfig.raiseDeprecationWarnings;
        if (val === false) {
          migratedConfig.suppressNotifications =
            migratedConfig.suppressNotifications || [];
          migratedConfig.suppressNotifications.push('deprecationWarningIssues');
        }
      } else if (key === 'binarySource' && val === 'auto') {
        migratedConfig.binarySource = 'global';
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
            new RegExp(from, 'g'),
            to
          );
        }
      }
    }
    if (migratedConfig.endpoints) {
      migratedConfig.hostRules = migratedConfig.endpoints;
      delete migratedConfig.endpoints;
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
      for (const packageRule of migratedConfig.packageRules) {
        if (is.array(packageRule.packageRules)) {
          logger.debug('Flattening nested packageRules');
          // merge each subrule and add to the parent list
          for (const subrule of packageRule.packageRules) {
            const combinedRule = mergeChildConfig(packageRule, subrule);
            delete combinedRule.packageRules;
            migratedConfig.packageRules.push(combinedRule);
          }
          // delete the nested packageRules
          delete packageRule.packageRules;
          // mark the original rule for deletion if it's now pointless
          if (
            !Object.keys(packageRule).some(
              (key) => !key.startsWith('match') && !key.startsWith('exclude')
            )
          ) {
            packageRule._delete = true;
          }
        }
      }
      // filter out any rules which were marked for deletion in the previous step
      migratedConfig.packageRules = migratedConfig.packageRules.filter(
        (rule) => !rule._delete
      );
    }
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
