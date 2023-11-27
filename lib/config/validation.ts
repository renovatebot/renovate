import is from '@sindresorhus/is';
import { allManagersList, getManagerList } from '../modules/manager';
import { isCustomManager } from '../modules/manager/custom';
import type {
  RegexManagerConfig,
  RegexManagerTemplates,
} from '../modules/manager/custom/regex/types';
import type { CustomManager } from '../modules/manager/custom/types';
import { configRegexPredicate, isConfigRegex, regEx } from '../util/regex';
import * as template from '../util/template';
import {
  hasValidSchedule,
  hasValidTimezone,
} from '../workers/repository/update/branch/schedule';
import { migrateConfig } from './migration';
import { getOptions } from './options';
import { resolveConfigPresets } from './presets';
import type {
  RenovateConfig,
  RenovateOptions,
  ValidationMessage,
  ValidationResult,
} from './types';
import * as managerValidator from './validation-helpers/managers';

const options = getOptions();

let optionTypes: Record<string, RenovateOptions['type']>;
let optionParents: Record<string, RenovateOptions['parent']>;

const managerList = getManagerList();

const topLevelObjects = managerList;

const ignoredNodes = [
  '$schema',
  'depType',
  'npmToken',
  'packageFile',
  'forkToken',
  'repository',
  'vulnerabilityAlertsOnly',
  'vulnerabilityAlert',
  'isVulnerabilityAlert',
  'copyLocalLibs', // deprecated - functionality is now enabled by default
  'prBody', // deprecated
  'minimumConfidence', // undocumented feature flag
];
const tzRe = regEx(/^:timezone\((.+)\)$/);
const rulesRe = regEx(/p.*Rules\[\d+\]$/);

function isManagerPath(parentPath: string): boolean {
  return (
    regEx(/^customManagers\[[0-9]+]$/).test(parentPath) ||
    managerList.includes(parentPath)
  );
}

function isIgnored(key: string): boolean {
  return ignoredNodes.includes(key);
}

function validatePlainObject(val: Record<string, unknown>): true | string {
  for (const [key, value] of Object.entries(val)) {
    if (!is.string(value)) {
      return key;
    }
  }
  return true;
}

function getUnsupportedEnabledManagers(enabledManagers: string[]): string[] {
  return enabledManagers.filter(
    (manager) => !allManagersList.includes(manager.replace('custom.', '')),
  );
}

function getDeprecationMessage(option: string): string | undefined {
  const deprecatedOptions: Record<string, string | undefined> = {
    branchName: `Direct editing of branchName is now deprecated. Please edit branchPrefix, additionalBranchPrefix, or branchTopic instead`,
    commitMessage: `Direct editing of commitMessage is now deprecated. Please edit commitMessage's subcomponents instead.`,
    prTitle: `Direct editing of prTitle is now deprecated. Please edit commitMessage subcomponents instead as they will be passed through to prTitle.`,
  };
  return deprecatedOptions[option];
}

export function getParentName(parentPath: string | undefined): string {
  return parentPath
    ? parentPath
        .replace(regEx(/\.?encrypted$/), '')
        .replace(regEx(/\[\d+\]$/), '')
        .split('.')
        .pop()!
    : '.';
}

export async function validateConfig(
  config: RenovateConfig,
  isPreset?: boolean,
  parentPath?: string,
): Promise<ValidationResult> {
  if (!optionTypes) {
    optionTypes = {};
    options.forEach((option) => {
      optionTypes[option.name] = option.type;
    });
  }
  if (!optionParents) {
    optionParents = {};
    options.forEach((option) => {
      if (option.parent) {
        optionParents[option.name] = option.parent;
      }
    });
  }
  let errors: ValidationMessage[] = [];
  let warnings: ValidationMessage[] = [];

  for (const [key, val] of Object.entries(config)) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    // istanbul ignore if
    if (key === '__proto__') {
      errors.push({
        topic: 'Config security error',
        message: '__proto__',
      });
      continue;
    }
    if (parentPath && topLevelObjects.includes(key)) {
      errors.push({
        topic: 'Configuration Error',
        message: `The "${key}" object can only be configured at the top level of a config but was found inside "${parentPath}"`,
      });
    }
    if (key === 'enabledManagers' && val) {
      const unsupportedManagers = getUnsupportedEnabledManagers(
        val as string[],
      );
      if (is.nonEmptyArray(unsupportedManagers)) {
        errors.push({
          topic: 'Configuration Error',
          message: `The following managers configured in enabledManagers are not supported: "${unsupportedManagers.join(
            ', ',
          )}"`,
        });
      }
    }
    if (key === 'fileMatch') {
      if (parentPath === undefined) {
        errors.push({
          topic: 'Config error',
          message: `"fileMatch" may not be defined at the top level of a config and must instead be within a manager block`,
        });
      } else if (!isManagerPath(parentPath)) {
        warnings.push({
          topic: 'Config warning',
          message: `"fileMatch" must be configured in a manager block and not here: ${parentPath}`,
        });
      }
    }
    if (
      !isIgnored(key) && // We need to ignore some reserved keys
      !(is as any).function(val) // Ignore all functions
    ) {
      if (getDeprecationMessage(key)) {
        warnings.push({
          topic: 'Deprecation Warning',
          message: getDeprecationMessage(key)!,
        });
      }
      const templateKeys = [
        'branchName',
        'commitBody',
        'commitMessage',
        'prTitle',
        'semanticCommitScope',
      ];
      if ((key.endsWith('Template') || templateKeys.includes(key)) && val) {
        try {
          // TODO: validate string #22198
          let res = template.compile((val as string).toString(), config, false);
          res = template.compile(res, config, false);
          template.compile(res, config, false);
        } catch (err) {
          errors.push({
            topic: 'Configuration Error',
            message: `Invalid template in config path: ${currentPath}`,
          });
        }
      }
      const parentName = getParentName(parentPath);
      if (
        !isPreset &&
        optionParents[key] &&
        optionParents[key] !== parentName
      ) {
        // TODO: types (#22198)
        const message = `${key} should only be configured within a "${optionParents[key]}" object. Was found in ${parentName}`;
        warnings.push({
          topic: `${parentPath ? `${parentPath}.` : ''}${key}`,
          message,
        });
      }
      if (!optionTypes[key]) {
        errors.push({
          topic: 'Configuration Error',
          message: `Invalid configuration option: ${currentPath}`,
        });
      } else if (key === 'schedule') {
        const [validSchedule, errorMessage] = hasValidSchedule(val as string[]);
        if (!validSchedule) {
          errors.push({
            topic: 'Configuration Error',
            message: `Invalid ${currentPath}: \`${errorMessage}\``,
          });
        }
      } else if (
        ['allowedVersions', 'matchCurrentVersion'].includes(key) &&
        isConfigRegex(val)
      ) {
        if (!configRegexPredicate(val)) {
          errors.push({
            topic: 'Configuration Error',
            message: `Invalid regExp for ${currentPath}: \`${val}\``,
          });
        }
      } else if (
        key === 'matchCurrentValue' &&
        is.string(val) &&
        !configRegexPredicate(val)
      ) {
        errors.push({
          topic: 'Configuration Error',
          message: `Invalid regExp for ${currentPath}: \`${val}\``,
        });
      } else if (key === 'timezone' && val !== null) {
        const [validTimezone, errorMessage] = hasValidTimezone(val as string);
        if (!validTimezone) {
          errors.push({
            topic: 'Configuration Error',
            message: `${currentPath}: ${errorMessage}`,
          });
        }
      } else if (val !== null) {
        const type = optionTypes[key];
        if (type === 'boolean') {
          if (val !== true && val !== false) {
            errors.push({
              topic: 'Configuration Error',
              message: `Configuration option \`${currentPath}\` should be boolean. Found: ${JSON.stringify(
                val,
              )} (${typeof val})`,
            });
          }
        } else if (type === 'integer') {
          if (!is.number(val)) {
            errors.push({
              topic: 'Configuration Error',
              message: `Configuration option \`${currentPath}\` should be an integer. Found: ${JSON.stringify(
                val,
              )} (${typeof val})`,
            });
          }
        } else if (type === 'array' && val) {
          if (is.array(val)) {
            for (const [subIndex, subval] of val.entries()) {
              if (is.object(subval)) {
                const subValidation = await validateConfig(
                  subval as RenovateConfig,
                  isPreset,
                  `${currentPath}[${subIndex}]`,
                );
                warnings = warnings.concat(subValidation.warnings);
                errors = errors.concat(subValidation.errors);
              }
            }
            if (key === 'extends') {
              for (const subval of val) {
                if (is.string(subval)) {
                  if (
                    parentName === 'packageRules' &&
                    subval.startsWith('group:')
                  ) {
                    warnings.push({
                      topic: 'Configuration Warning',
                      message: `${currentPath}: you should not extend "group:" presets`,
                    });
                  }
                  if (tzRe.test(subval)) {
                    const [, timezone] = tzRe.exec(subval)!;
                    const [validTimezone, errorMessage] =
                      hasValidTimezone(timezone);
                    if (!validTimezone) {
                      errors.push({
                        topic: 'Configuration Error',
                        message: `${currentPath}: ${errorMessage}`,
                      });
                    }
                  }
                } else {
                  errors.push({
                    topic: 'Configuration Warning',
                    message: `${currentPath}: preset value is not a string`,
                  });
                }
              }
            }

            const selectors = [
              'matchFileNames',
              'matchLanguages',
              'matchCategories',
              'matchBaseBranches',
              'matchManagers',
              'matchDatasources',
              'matchDepTypes',
              'matchDepNames',
              'matchDepPatterns',
              'matchPackageNames',
              'matchPackagePatterns',
              'matchPackagePrefixes',
              'excludeDepNames',
              'excludeDepPatterns',
              'excludePackageNames',
              'excludePackagePatterns',
              'excludePackagePrefixes',
              'excludeRepositories',
              'matchCurrentValue',
              'matchCurrentVersion',
              'matchSourceUrlPrefixes',
              'matchSourceUrls',
              'matchUpdateTypes',
              'matchConfidence',
              'matchRepositories',
            ];
            if (key === 'packageRules') {
              for (const [subIndex, packageRule] of val.entries()) {
                if (is.object(packageRule)) {
                  const resolvedRule = migrateConfig({
                    packageRules: [
                      await resolveConfigPresets(
                        packageRule as RenovateConfig,
                        config,
                      ),
                    ],
                  }).migratedConfig.packageRules![0];
                  errors.push(
                    ...managerValidator.check({ resolvedRule, currentPath }),
                  );
                  const selectorLength = Object.keys(resolvedRule).filter(
                    (ruleKey) => selectors.includes(ruleKey),
                  ).length;
                  if (!selectorLength) {
                    const message = `${currentPath}[${subIndex}]: Each packageRule must contain at least one match* or exclude* selector. Rule: ${JSON.stringify(
                      packageRule,
                    )}`;
                    errors.push({
                      topic: 'Configuration Error',
                      message,
                    });
                  }
                  if (selectorLength === Object.keys(resolvedRule).length) {
                    const message = `${currentPath}[${subIndex}]: Each packageRule must contain at least one non-match* or non-exclude* field. Rule: ${JSON.stringify(
                      packageRule,
                    )}`;
                    warnings.push({
                      topic: 'Configuration Error',
                      message,
                    });
                  }
                  // It's too late to apply any of these options once you already have updates determined
                  const preLookupOptions = [
                    'allowedVersions',
                    'extractVersion',
                    'followTag',
                    'ignoreDeps',
                    'ignoreUnstable',
                    'rangeStrategy',
                    'registryUrls',
                    'respectLatest',
                    'rollbackPrs',
                    'separateMajorMinor',
                    'separateMinorPatch',
                    'separateMultipleMajor',
                    'versioning',
                  ];
                  if (is.nonEmptyArray(resolvedRule.matchUpdateTypes)) {
                    for (const option of preLookupOptions) {
                      if (resolvedRule[option] !== undefined) {
                        const message = `${currentPath}[${subIndex}]: packageRules cannot combine both matchUpdateTypes and ${option}. Rule: ${JSON.stringify(
                          packageRule,
                        )}`;
                        errors.push({
                          topic: 'Configuration Error',
                          message,
                        });
                      }
                    }
                  }
                } else {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `${currentPath} must contain JSON objects`,
                  });
                }
              }
            }
            if (key === 'customManagers') {
              const allowedKeys = [
                'customType',
                'description',
                'fileMatch',
                'matchStrings',
                'matchStringsStrategy',
                'depNameTemplate',
                'packageNameTemplate',
                'datasourceTemplate',
                'versioningTemplate',
                'registryUrlTemplate',
                'currentValueTemplate',
                'extractVersionTemplate',
                'autoReplaceStringTemplate',
                'depTypeTemplate',
              ];
              for (const customManager of val as CustomManager[]) {
                if (
                  Object.keys(customManager).some(
                    (k) => !allowedKeys.includes(k),
                  )
                ) {
                  const disallowedKeys = Object.keys(customManager).filter(
                    (k) => !allowedKeys.includes(k),
                  );
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Custom Manager contains disallowed fields: ${disallowedKeys.join(
                      ', ',
                    )}`,
                  });
                } else if (
                  is.nonEmptyString(customManager.customType) &&
                  isCustomManager(customManager.customType)
                ) {
                  if (is.nonEmptyArray(customManager.fileMatch)) {
                    switch (customManager.customType) {
                      case 'regex':
                        validateRegexManagerFields(
                          customManager,
                          currentPath,
                          errors,
                        );
                        break;
                    }
                  } else {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Each Custom Manager must contain a non-empty fileMatch array`,
                    });
                  }
                } else {
                  if (
                    is.emptyString(customManager.customType) ||
                    is.undefined(customManager.customType)
                  ) {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Each Custom Manager must contain a non-empty customType string`,
                    });
                  } else {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Invalid customType: ${customManager.customType}. Key is not a custom manager`,
                    });
                  }
                }
              }
            }
            if (
              [
                'matchPackagePatterns',
                'excludePackagePatterns',
                'matchDepPatterns',
                'excludeDepPatterns',
              ].includes(key)
            ) {
              for (const pattern of val as string[]) {
                if (pattern !== '*') {
                  try {
                    regEx(pattern);
                  } catch (e) {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Invalid regExp for ${currentPath}: \`${pattern}\``,
                    });
                  }
                }
              }
            }
            if (key === 'fileMatch') {
              for (const fileMatch of val as string[]) {
                try {
                  regEx(fileMatch);
                } catch (e) {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Invalid regExp for ${currentPath}: \`${fileMatch}\``,
                  });
                }
              }
            }
            if (key === 'baseBranches') {
              for (const baseBranch of val as string[]) {
                if (
                  isConfigRegex(baseBranch) &&
                  !configRegexPredicate(baseBranch)
                ) {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Invalid regExp for ${currentPath}: \`${baseBranch}\``,
                  });
                }
              }
            }
            if (
              (selectors.includes(key) ||
                key === 'matchCurrentVersion' ||
                key === 'matchCurrentValue') &&
              // TODO: can be undefined ? #22198
              !rulesRe.test(parentPath!) && // Inside a packageRule
              (is.string(parentPath) || !isPreset) // top level in a preset
            ) {
              errors.push({
                topic: 'Configuration Error',
                message: `${currentPath}: ${key} should be inside a \`packageRule\` only`,
              });
            }
          } else {
            errors.push({
              topic: 'Configuration Error',
              message: `Configuration option \`${currentPath}\` should be a list (Array)`,
            });
          }
        } else if (type === 'string') {
          if (!is.string(val)) {
            errors.push({
              topic: 'Configuration Error',
              message: `Configuration option \`${currentPath}\` should be a string`,
            });
          }
        } else if (
          type === 'object' &&
          currentPath !== 'compatibility' &&
          currentPath !== 'constraints' &&
          currentPath !== 'force.constraints'
        ) {
          if (is.plainObject(val)) {
            if (key === 'registryAliases') {
              const res = validatePlainObject(val);
              if (res !== true) {
                errors.push({
                  topic: 'Configuration Error',
                  message: `Invalid \`${currentPath}.${key}.${res}\` configuration: value is not a string`,
                });
              }
            } else if (key === 'customDatasources') {
              const allowedKeys = [
                'description',
                'defaultRegistryUrlTemplate',
                'format',
                'transformTemplates',
              ];
              for (const [
                customDatasourceName,
                customDatasourceValue,
              ] of Object.entries(val)) {
                if (!is.plainObject(customDatasourceValue)) {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Invalid \`${currentPath}.${customDatasourceName}\` configuration: customDatasource is not an object`,
                  });
                  continue;
                }
                for (const [subKey, subValue] of Object.entries(
                  customDatasourceValue,
                )) {
                  if (!allowedKeys.includes(subKey)) {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Invalid \`${currentPath}.${key}.${subKey}\` configuration: key is not allowed`,
                    });
                  } else if (subKey === 'transformTemplates') {
                    if (!is.array(subValue, is.string)) {
                      errors.push({
                        topic: 'Configuration Error',
                        message: `Invalid \`${currentPath}.${key}.${subKey}\` configuration: is not an array of string`,
                      });
                    }
                  } else if (!is.string(subValue)) {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Invalid \`${currentPath}.${key}.${subKey}\` configuration: is a string`,
                    });
                  }
                }
              }
            } else if (
              [
                'customEnvVariables',
                'migratePresets',
                'productLinks',
                'secrets',
                'customizeDashboard',
              ].includes(key)
            ) {
              const res = validatePlainObject(val);
              if (res !== true) {
                errors.push({
                  topic: 'Configuration Error',
                  message: `Invalid \`${currentPath}.${key}.${res}\` configuration: value is not a string`,
                });
              }
            } else {
              const ignoredObjects = options
                .filter((option) => option.freeChoice)
                .map((option) => option.name);
              if (!ignoredObjects.includes(key)) {
                const subValidation = await validateConfig(
                  val,
                  isPreset,
                  currentPath,
                );
                warnings = warnings.concat(subValidation.warnings);
                errors = errors.concat(subValidation.errors);
              }
            }
          } else {
            errors.push({
              topic: 'Configuration Error',
              message: `Configuration option \`${currentPath}\` should be a json object`,
            });
          }
        }
      }
    }
  }

  function sortAll(a: ValidationMessage, b: ValidationMessage): number {
    // istanbul ignore else: currently never happen
    if (a.topic === b.topic) {
      return a.message > b.message ? 1 : -1;
    }
    // istanbul ignore next: currently never happen
    return a.topic > b.topic ? 1 : -1;
  }

  errors.sort(sortAll);
  warnings.sort(sortAll);
  return { errors, warnings };
}

function validateRegexManagerFields(
  customManager: Partial<RegexManagerConfig>,
  currentPath: string,
  errors: ValidationMessage[],
): void {
  if (is.nonEmptyArray(customManager.matchStrings)) {
    for (const matchString of customManager.matchStrings) {
      try {
        regEx(matchString);
      } catch (e) {
        errors.push({
          topic: 'Configuration Error',
          message: `Invalid regExp for ${currentPath}: \`${matchString}\``,
        });
      }
    }
  } else {
    errors.push({
      topic: 'Configuration Error',
      message: `Each Custom Manager must contain a non-empty matchStrings array`,
    });
  }

  const mandatoryFields = ['depName', 'currentValue', 'datasource'];
  for (const field of mandatoryFields) {
    const templateField = `${field}Template` as keyof RegexManagerTemplates;
    if (
      !customManager[templateField] &&
      !customManager.matchStrings?.some((matchString) =>
        matchString.includes(`(?<${field}>`),
      )
    ) {
      errors.push({
        topic: 'Configuration Error',
        message: `Regex Managers must contain ${field}Template configuration or regex group named ${field}`,
      });
    }
  }
}
