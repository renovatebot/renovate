import later from '@breejs/later';
import is from '@sindresorhus/is';
import { logger } from '../logger';
import { HostRule } from '../types';
import { clone } from '../util/clone';
import { PackageRule, RenovateConfig } from './common';
import { RenovateOptions, getOptions } from './definitions';

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
    let isMigrated = false;
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
        isMigrated = true;
        delete migratedConfig[key];
      } else if (key === 'pathRules') {
        isMigrated = true;
        if (is.array(val)) {
          migratedConfig.packageRules = migratedConfig.packageRules || [];
          const migratedPathRules = migratedConfig.pathRules.map(
            (p) => migrateConfig(p, key).migratedConfig
          );
          migratedConfig.packageRules = migratedPathRules.concat(
            migratedConfig.packageRules
          );
        }
        delete migratedConfig.pathRules;
      } else if (key === 'suppressNotifications') {
        if (is.nonEmptyArray(val) && val.includes('prEditNotification')) {
          isMigrated = true;
          migratedConfig.suppressNotifications = migratedConfig.suppressNotifications.filter(
            (item) => item !== 'prEditNotification'
          );
        }
      } else if (key.startsWith('masterIssue')) {
        isMigrated = true;
        const newKey = key.replace('masterIssue', 'dependencyDashboard');
        migratedConfig[newKey] = val;
        if (optionTypes[newKey] === 'boolean' && val === 'true') {
          migratedConfig[newKey] = true;
        }
        delete migratedConfig[key];
      } else if (key === 'gomodTidy') {
        isMigrated = true;
        if (val) {
          migratedConfig.postUpdateOptions =
            migratedConfig.postUpdateOptions || [];
          migratedConfig.postUpdateOptions.push('gomodTidy');
        }
        delete migratedConfig.gomodTidy;
      } else if (key === 'semanticCommits') {
        if (val === true) {
          migratedConfig.semanticCommits = 'enabled';
          isMigrated = true;
        } else if (val === false) {
          migratedConfig.semanticCommits = 'disabled';
          isMigrated = true;
        } else if (val !== 'enabled' && val !== 'disabled') {
          migratedConfig.semanticCommits = 'auto';
          isMigrated = true;
        }
      } else if (parentKey === 'hostRules' && key === 'platform') {
        isMigrated = true;
        migratedConfig.hostType = val;
        delete migratedConfig.platform;
      } else if (parentKey === 'hostRules' && key === 'endpoint') {
        isMigrated = true;
        migratedConfig.baseUrl = val;
        delete migratedConfig.endpoint;
      } else if (parentKey === 'hostRules' && key === 'host') {
        isMigrated = true;
        migratedConfig.hostName = val;
        delete migratedConfig.host;
      } else if (key === 'packageFiles' && is.array(val)) {
        isMigrated = true;
        const fileList = [];
        for (const packageFile of val) {
          if (is.object(packageFile) && !is.array(packageFile)) {
            fileList.push((packageFile as any).packageFile);
            if (Object.keys(packageFile).length > 1) {
              migratedConfig.packageRules = migratedConfig.packageRules || [];
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
        isMigrated = true;
        migratedConfig.packageRules = migratedConfig.packageRules || [];
        const depTypePackageRule = migrateConfig(val as RenovateConfig, key)
          .migratedConfig;
        depTypePackageRule.depTypeList = [key];
        delete depTypePackageRule.packageRules;
        migratedConfig.packageRules.push(depTypePackageRule);
        delete migratedConfig[key];
      } else if (key === 'pinVersions') {
        isMigrated = true;
        delete migratedConfig.pinVersions;
        if (val === true) {
          migratedConfig.rangeStrategy = 'pin';
        } else if (val === false) {
          migratedConfig.rangeStrategy = 'replace';
        }
      } else if (key === 'gitFs') {
        isMigrated = true;
        delete migratedConfig.gitFs;
      } else if (key === 'rebaseStalePrs') {
        isMigrated = true;
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
        isMigrated = true;
        delete migratedConfig.rebaseConflictedPrs;
        if (val === false) {
          migratedConfig.rebaseWhen = 'never';
        }
      } else if (key === 'exposeEnv') {
        isMigrated = true;
        delete migratedConfig.exposeEnv;
        if (val === true) {
          migratedConfig.trustLevel = 'high';
        } else if (val === false) {
          migratedConfig.trustLevel = 'low';
        }
      } else if (key === 'managerBranchPrefix') {
        isMigrated = true;
        delete migratedConfig.managerBranchPrefix;
        migratedConfig.additionalBranchPrefix = val;
      } else if (
        key === 'branchPrefix' &&
        is.string(val) &&
        val.includes('{{')
      ) {
        isMigrated = true;
        const templateIndex = val.indexOf(`{{`);
        migratedConfig.branchPrefix = val.substring(0, templateIndex);
        migratedConfig.additionalBranchPrefix = val.substring(templateIndex);
      } else if (key === 'upgradeInRange') {
        isMigrated = true;
        delete migratedConfig.upgradeInRange;
        if (val === true) {
          migratedConfig.rangeStrategy = 'bump';
        }
      } else if (key === 'versionStrategy') {
        isMigrated = true;
        delete migratedConfig.versionStrategy;
        if (val === 'widen') {
          migratedConfig.rangeStrategy = 'widen';
        }
      } else if (key === 'semanticPrefix' && is.string(val)) {
        isMigrated = true;
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
          isMigrated = true;
        }
        const presets = migratedConfig.extends;
        for (let i = 0; i < presets.length; i += 1) {
          let preset = presets[i];
          if (is.string(preset)) {
            if (preset === 'config:application' || preset === ':js-app') {
              isMigrated = true;
              preset = 'config:js-app';
            } else if (preset === ':library' || preset === 'config:library') {
              isMigrated = true;
              preset = 'config:js-lib';
            } else if (preset.startsWith(':masterIssue')) {
              isMigrated = true;
              preset = preset.replace('masterIssue', 'dependencyDashboard');
            }
            presets[i] = preset;
          }
        }
      } else if (key === 'versionScheme') {
        isMigrated = true;
        migratedConfig.versioning = val;
        delete migratedConfig.versionScheme;
      } else if (
        key === 'automergeType' &&
        is.string(val) &&
        val.startsWith('branch-')
      ) {
        isMigrated = true;
        migratedConfig.automergeType = 'branch';
      } else if (key === 'automergeMinor') {
        isMigrated = true;
        migratedConfig.minor = migratedConfig.minor || {};
        migratedConfig.minor.automerge = val == true; // eslint-disable-line eqeqeq
        delete migratedConfig[key];
      } else if (key === 'automergeMajor') {
        isMigrated = true;
        migratedConfig.major = migratedConfig.major || {};
        migratedConfig.major.automerge = val == true; // eslint-disable-line eqeqeq
        delete migratedConfig[key];
      } else if (key === 'multipleMajorPrs') {
        isMigrated = true;
        delete migratedConfig.multipleMajorPrs;
        migratedConfig.separateMultipleMajor = val;
      } else if (key === 'renovateFork' && is.boolean(val)) {
        isMigrated = true;
        delete migratedConfig.renovateFork;
        migratedConfig.includeForks = val;
      } else if (key === 'separateMajorReleases') {
        isMigrated = true;
        delete migratedConfig.separateMultipleMajor;
        migratedConfig.separateMajorMinor = val;
      } else if (key === 'separatePatchReleases') {
        isMigrated = true;
        delete migratedConfig.separatePatchReleases;
        migratedConfig.separateMinorPatch = val;
      } else if (key === 'automergePatch') {
        isMigrated = true;
        migratedConfig.patch = migratedConfig.patch || {};
        migratedConfig.patch.automerge = val == true; // eslint-disable-line eqeqeq
        delete migratedConfig[key];
      } else if (key === 'ignoreNodeModules') {
        isMigrated = true;
        delete migratedConfig.ignoreNodeModules;
        migratedConfig.ignorePaths = val ? ['node_modules/'] : [];
      } else if (
        key === 'automerge' &&
        is.string(val) &&
        ['none', 'patch', 'minor', 'any'].includes(val)
      ) {
        delete migratedConfig.automerge;
        isMigrated = true;
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
        isMigrated = true;
        migratedConfig.packageRules = migratedConfig.packageRules || [];
        migratedConfig.packageRules = migratedConfig.packageRules.concat(
          migratedConfig.packages.map(
            (p) => migrateConfig(p, key).migratedConfig
          )
        );
        delete migratedConfig.packages;
      } else if (key === 'excludedPackageNames') {
        isMigrated = true;
        migratedConfig.excludePackageNames = val;
        delete migratedConfig.excludedPackageNames;
      } else if (key === 'packageName') {
        isMigrated = true;
        migratedConfig.packageNames = [val];
        delete migratedConfig.packageName;
      } else if (key === 'packagePattern') {
        isMigrated = true;
        migratedConfig.packagePatterns = [val];
        delete migratedConfig.packagePattern;
      } else if (key === 'baseBranch') {
        isMigrated = true;
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
              isMigrated = true;
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
            isMigrated = true;
            schedules[i] = schedules[i].replace(
              'on the last day of the month',
              'on the first day of the month'
            );
          }
          if (schedules[i].includes('on every weekday')) {
            isMigrated = true;
            schedules[i] = schedules[i].replace(
              'on every weekday',
              'every weekday'
            );
          }
          if (schedules[i].endsWith(' every day')) {
            isMigrated = true;
            schedules[i] = schedules[i].replace(' every day', '');
          }
          if (
            /every (mon|tues|wednes|thurs|fri|satur|sun)day$/.test(schedules[i])
          ) {
            isMigrated = true;
            schedules[i] = schedules[i].replace(/every ([a-z]*day)$/, 'on $1');
          }
          if (schedules[i].endsWith('days')) {
            isMigrated = true;
            schedules[i] = schedules[i].replace('days', 'day');
          }
        }
        if (isMigrated) {
          if (is.string(val) && schedules.length === 1) {
            [migratedConfig.schedule] = schedules as any; // TODO: fixme
          } else {
            migratedConfig.schedule = schedules;
          }
        }
      } else if (is.string(val) && val.startsWith('{{semanticPrefix}}')) {
        isMigrated = true;
        migratedConfig[key] = val.replace(
          '{{semanticPrefix}}',
          '{{#if semanticCommitType}}{{semanticCommitType}}{{#if semanticCommitScope}}({{semanticCommitScope}}){{/if}}: {{/if}}'
        );
      } else if (key === 'depTypes' && is.array(val)) {
        val.forEach((depType) => {
          if (is.object(depType) && !is.array(depType)) {
            const depTypeName = (depType as any).depType;
            if (depTypeName) {
              migratedConfig.packageRules = migratedConfig.packageRules || [];
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
        isMigrated = true;
        delete migratedConfig.depTypes;
      } else if (optionTypes[key] === 'object' && is.boolean(val)) {
        isMigrated = true;
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
        isMigrated = true;
        delete migratedConfig.node.enabled;
        migratedConfig.travis = migratedConfig.travis || {};
        migratedConfig.travis.enabled = true;
        if (!Object.keys(migratedConfig.node).length) {
          delete migratedConfig.node;
        } else {
          const subMigrate = migrateConfig(migratedConfig.node, key);
          migratedConfig.node = subMigrate.migratedConfig;
        }
      } else if (is.array(val)) {
        const newArray = [];
        for (const item of migratedConfig[key] as unknown[]) {
          if (is.object(item) && !is.array(item)) {
            const arrMigrate = migrateConfig(item as RenovateConfig, key);
            newArray.push(arrMigrate.migratedConfig);
            if (arrMigrate.isMigrated) {
              isMigrated = true;
            }
          } else {
            newArray.push(item);
          }
        }
        migratedConfig[key] = newArray;
      } else if (key === 'compatibility' && is.object(val)) {
        isMigrated = true;
        migratedConfig.constraints = migratedConfig.compatibility;
        delete migratedConfig.compatibility;
      } else if (is.object(val)) {
        const subMigrate = migrateConfig(
          migratedConfig[key] as RenovateConfig,
          key
        );
        if (subMigrate.isMigrated) {
          isMigrated = true;
          migratedConfig[key] = subMigrate.migratedConfig;
        }
      } else if (
        key.startsWith('commitMessage') &&
        is.string(val) &&
        (val.includes('currentVersion') || val.includes('newVersion'))
      ) {
        isMigrated = true;
        migratedConfig[key] = val
          .replace(/currentVersion/g, 'currentValue')
          .replace(/newVersion/g, 'newValue')
          .replace(/newValueMajor/g, 'newMajor')
          .replace(/newValueMinor/g, 'newMinor');
      } else if (key === 'raiseDeprecationWarnings') {
        isMigrated = true;
        delete migratedConfig.raiseDeprecationWarnings;
        if (val === false) {
          migratedConfig.suppressNotifications =
            migratedConfig.suppressNotifications || [];
          migratedConfig.suppressNotifications.push('deprecationWarningIssues');
        }
      }
    }
    if (migratedConfig.endpoints) {
      migratedConfig.hostRules = migratedConfig.endpoints;
      delete migratedConfig.endpoints;
      isMigrated = true;
    }
    return { isMigrated, migratedConfig };
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ config }, 'migrateConfig() error');
    throw err;
  }
}
