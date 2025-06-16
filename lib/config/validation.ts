import is from '@sindresorhus/is';
import { allManagersList, getManagerList } from '../modules/manager';
import { isCustomManager } from '../modules/manager/custom';
import type { CustomManager } from '../modules/manager/custom/types';
import type { HostRule } from '../types';
import { getExpression } from '../util/jsonata';
import { regEx } from '../util/regex';
import {
  getRegexPredicate,
  isRegexMatch,
  matchRegexOrGlobList,
} from '../util/string-match';
import * as template from '../util/template';
import { parseUrl } from '../util/url';
import {
  hasValidSchedule,
  hasValidTimezone,
} from '../workers/repository/update/branch/schedule';
import { configFileNames } from './app-strings';
import { GlobalConfig } from './global';
import { migrateConfig } from './migration';
import { getOptions } from './options';
import { resolveConfigPresets } from './presets';
import { supportedDatasources } from './presets/internal/merge-confidence';
import type {
  AllowedParents,
  RenovateConfig,
  RenovateOptions,
  StatusCheckKey,
  ValidationMessage,
  ValidationResult,
} from './types';
import { allowedStatusCheckStrings } from './types';
import * as managerValidator from './validation-helpers/managers';
import * as matchBaseBranchesValidator from './validation-helpers/match-base-branches';
import * as regexOrGlobValidator from './validation-helpers/regex-glob-matchers';
import {
  getParentName,
  isFalseGlobal,
  validateJSONataManagerFields,
  validateNumber,
  validatePlainObject,
  validateRegexManagerFields,
} from './validation-helpers/utils';

const options = getOptions();

let optionsInitialized = false;
let optionTypes: Record<string, RenovateOptions['type']>;
let optionParents: Record<string, AllowedParents[]>;
let optionGlobals: Set<string>;
let optionInherits: Set<string>;
let optionRegexOrGlob: Set<string>;
let optionAllowsNegativeIntegers: Set<string>;

const managerList = getManagerList();

const topLevelObjects = [...managerList, 'env'];

const ignoredNodes = [
  '$schema',
  'headers',
  'depType',
  'npmToken',
  'packageFile',
  'forkToken',
  'repository',
  'vulnerabilityAlertsOnly',
  'vulnerabilityAlert',
  'isVulnerabilityAlert',
  'vulnerabilityFixVersion', // not intended to be used by end users but may be by Mend apps
  'copyLocalLibs', // deprecated - functionality is now enabled by default
  'prBody', // deprecated
  'minimumConfidence', // undocumented feature flag
];
const tzRe = regEx(/^:timezone\((.+)\)$/);
const rulesRe = regEx(/p.*Rules\[\d+\]$/);

function isIgnored(key: string): boolean {
  return ignoredNodes.includes(key);
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

function isInhertConfigOption(key: string): boolean {
  return optionInherits.has(key);
}

function isRegexOrGlobOption(key: string): boolean {
  return optionRegexOrGlob.has(key);
}

function isGlobalOption(key: string): boolean {
  return optionGlobals.has(key);
}

function initOptions(): void {
  if (optionsInitialized) {
    return;
  }

  optionParents = {};
  optionInherits = new Set();
  optionTypes = {};
  optionRegexOrGlob = new Set();
  optionGlobals = new Set();
  optionAllowsNegativeIntegers = new Set();

  for (const option of options) {
    optionTypes[option.name] = option.type;

    if (option.parents) {
      optionParents[option.name] = option.parents;
    }

    if (option.inheritConfigSupport) {
      optionInherits.add(option.name);
    }

    if (option.patternMatch) {
      optionRegexOrGlob.add(option.name);
    }

    if (option.globalOnly) {
      optionGlobals.add(option.name);
    }

    if (option.allowNegative) {
      optionAllowsNegativeIntegers.add(option.name);
    }
  }

  optionsInitialized = true;
}

export async function validateConfig(
  configType: 'global' | 'inherit' | 'repo',
  config: RenovateConfig,
  isPreset?: boolean,
  parentPath?: string,
): Promise<ValidationResult> {
  initOptions();

  let errors: ValidationMessage[] = [];
  let warnings: ValidationMessage[] = [];

  for (const [key, val] of Object.entries(config)) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    /* v8 ignore next 7 -- TODO: add test */
    if (key === '__proto__') {
      errors.push({
        topic: 'Config security error',
        message: '__proto__',
      });
      continue;
    }
    if (
      parentPath &&
      parentPath !== 'onboardingConfig' &&
      topLevelObjects.includes(key)
    ) {
      errors.push({
        topic: 'Configuration Error',
        message: `The "${key}" object can only be configured at the top level of a config but was found inside "${parentPath}"`,
      });
    }

    if (isGlobalOption(key)) {
      if (configType === 'global') {
        await validateGlobalConfig(
          key,
          val,
          optionTypes[key],
          warnings,
          errors,
          currentPath,
          config,
        );
        continue;
      } else if (
        !isFalseGlobal(key, parentPath) &&
        !(configType === 'inherit' && isInhertConfigOption(key))
      ) {
        warnings.push({
          topic: 'Configuration Error',
          message: `The "${key}" option is a global option reserved only for Renovate's global configuration and cannot be configured within a repository's config file.`,
        });
        continue;
      }
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
        } catch {
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
        !optionParents[key].includes(parentName as AllowedParents)
      ) {
        // TODO: types (#22198)
        const message = `${key} should only be configured within one of "${optionParents[
          key
        ]?.join(' or ')}" objects. Was found in ${parentName}`;
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
        [
          'allowedVersions',
          'matchCurrentVersion',
          'matchCurrentValue',
          'matchNewValue',
        ].includes(key) &&
        isRegexMatch(val)
      ) {
        if (!getRegexPredicate(val)) {
          errors.push({
            topic: 'Configuration Error',
            message: `Invalid regExp for ${currentPath}: \`${val}\``,
          });
        }
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
          const allowsNegative = optionAllowsNegativeIntegers.has(key);
          errors.push(...validateNumber(key, val, allowsNegative, currentPath));
        } else if (type === 'array' && val) {
          if (is.array(val)) {
            for (const [subIndex, subval] of val.entries()) {
              if (is.object(subval)) {
                const subValidation = await validateConfig(
                  configType,
                  subval as RenovateConfig,
                  isPreset,
                  `${currentPath}[${subIndex}]`,
                );
                warnings = warnings.concat(subValidation.warnings);
                errors = errors.concat(subValidation.errors);
              }
            }
            if (isRegexOrGlobOption(key)) {
              errors.push(
                ...regexOrGlobValidator.check({
                  val,
                  currentPath,
                }),
              );
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
              'matchPackageNames',
              'matchCurrentValue',
              'matchCurrentVersion',
              'matchSourceUrls',
              'matchUpdateTypes',
              'matchConfidence',
              'matchCurrentAge',
              'matchRepositories',
              'matchNewValue',
              'matchJsonata',
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
                  warnings.push(
                    ...matchBaseBranchesValidator.check({
                      resolvedRule,
                      currentPath: `${currentPath}[${subIndex}]`,
                      baseBranches: config.baseBranches!,
                    }),
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
                    'separateMultipleMinor',
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
                'fileFormat',
                'managerFilePatterns',
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
                  if (is.nonEmptyArray(customManager.managerFilePatterns)) {
                    switch (customManager.customType) {
                      case 'regex':
                        validateRegexManagerFields(
                          customManager,
                          currentPath,
                          errors,
                        );
                        break;
                      case 'jsonata':
                        validateJSONataManagerFields(
                          customManager,
                          currentPath,
                          errors,
                        );
                        break;
                    }
                  } else {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Each Custom Manager must contain a non-empty managerFilePatterns array`,
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
            if (['matchPackageNames', 'matchDepNames'].includes(key)) {
              const startPattern = regEx(/!?\//);
              const endPattern = regEx(/\/g?i?$/);
              for (const pattern of val as string[]) {
                if (startPattern.test(pattern) && endPattern.test(pattern)) {
                  try {
                    // regEx isn't aware of our !/ prefix but can handle the suffix
                    regEx(pattern.replace(startPattern, '/'));
                  } catch {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Invalid regExp for ${currentPath}: \`${pattern}\``,
                    });
                  }
                }
              }
            }
            if (key === 'baseBranches') {
              for (const baseBranch of val as string[]) {
                if (
                  isRegexMatch(baseBranch) &&
                  !getRegexPredicate(baseBranch)
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
          key !== 'constraints'
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
            } else if (key === 'env') {
              const allowedEnvVars =
                configType === 'global'
                  ? ((config.allowedEnv as string[]) ?? [])
                  : GlobalConfig.get('allowedEnv', []);
              for (const [envVarName, envVarValue] of Object.entries(val)) {
                if (!is.string(envVarValue)) {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Invalid env variable value: \`${currentPath}.${envVarName}\` must be a string.`,
                  });
                }
                if (!matchRegexOrGlobList(envVarName, allowedEnvVars)) {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Env variable name \`${envVarName}\` is not allowed by this bot's \`allowedEnv\`.`,
                  });
                }
              }
            } else if (key === 'statusCheckNames') {
              for (const [statusCheckKey, statusCheckValue] of Object.entries(
                val,
              )) {
                if (
                  !allowedStatusCheckStrings.includes(
                    statusCheckKey as StatusCheckKey,
                  )
                ) {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Invalid \`${currentPath}.${key}.${statusCheckKey}\` configuration: key is not allowed.`,
                  });
                }
                if (
                  !(is.string(statusCheckValue) || null === statusCheckValue)
                ) {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Invalid \`${currentPath}.${statusCheckKey}\` configuration: status check is not a string.`,
                  });
                  continue;
                }
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
                      message: `Invalid \`${currentPath}.${subKey}\` configuration: key is not allowed`,
                    });
                  } else if (subKey === 'transformTemplates') {
                    if (!is.array(subValue, is.string)) {
                      errors.push({
                        topic: 'Configuration Error',
                        message: `Invalid \`${currentPath}.${subKey}\` configuration: is not an array of string`,
                      });
                    }
                  } else if (subKey === 'description') {
                    if (
                      !(is.string(subValue) || is.array(subValue, is.string))
                    ) {
                      errors.push({
                        topic: 'Configuration Error',
                        message: `Invalid \`${currentPath}.${subKey}\` configuration: is not an array of strings`,
                      });
                    }
                  } else if (!is.string(subValue)) {
                    errors.push({
                      topic: 'Configuration Error',
                      message: `Invalid \`${currentPath}.${subKey}\` configuration: is a string`,
                    });
                  }
                }
              }
            } else {
              const ignoredObjects = options
                .filter((option) => option.freeChoice)
                .map((option) => option.name);
              if (!ignoredObjects.includes(key)) {
                const subValidation = await validateConfig(
                  configType,
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

    if (key === 'hostRules' && is.array(val)) {
      const allowedHeaders =
        configType === 'global'
          ? ((config.allowedHeaders as string[]) ?? [])
          : GlobalConfig.get('allowedHeaders', []);
      for (const rule of val as HostRule[]) {
        if (is.nonEmptyString(rule.matchHost)) {
          if (rule.matchHost.includes('://')) {
            if (parseUrl(rule.matchHost) === null) {
              errors.push({
                topic: 'Configuration Error',
                message: `hostRules matchHost \`${rule.matchHost}\` is not a valid URL.`,
              });
            }
          }
        } else if (is.emptyString(rule.matchHost)) {
          errors.push({
            topic: 'Configuration Error',
            message:
              'Invalid value for hostRules matchHost. It cannot be an empty string.',
          });
        }

        if (!rule.headers) {
          continue;
        }
        for (const [header, value] of Object.entries(rule.headers)) {
          if (!is.string(value)) {
            errors.push({
              topic: 'Configuration Error',
              message: `Invalid hostRules headers value configuration: header must be a string.`,
            });
          }
          if (!matchRegexOrGlobList(header, allowedHeaders)) {
            errors.push({
              topic: 'Configuration Error',
              message: `hostRules header \`${header}\` is not allowed by this bot's \`allowedHeaders\`.`,
            });
          }
        }
      }
    }

    if (key === 'matchJsonata' && is.array(val, is.string)) {
      for (const expression of val) {
        const res = getExpression(expression);
        if (res instanceof Error) {
          errors.push({
            topic: 'Configuration Error',
            message: `Invalid JSONata expression for ${currentPath}: ${res.message}`,
          });
        }
      }
    }
  }

  function sortAll(a: ValidationMessage, b: ValidationMessage): number {
    if (a.topic === b.topic) {
      return a.message > b.message ? 1 : -1;
    }
    return a.topic > b.topic ? 1 : -1;
  }

  errors.sort(sortAll);
  warnings.sort(sortAll);
  return { errors, warnings };
}

/**
 * Basic validation for global config options
 */
async function validateGlobalConfig(
  key: string,
  val: unknown,
  type: string,
  warnings: ValidationMessage[],
  errors: ValidationMessage[],
  currentPath: string | undefined,
  config: RenovateConfig,
): Promise<void> {
  /* v8 ignore next 5 -- not testable yet */
  if (getDeprecationMessage(key)) {
    warnings.push({
      topic: 'Deprecation Warning',
      message: getDeprecationMessage(key)!,
    });
  }
  if (val !== null) {
    if (type === 'string') {
      if (is.string(val)) {
        if (
          key === 'onboardingConfigFileName' &&
          !configFileNames.includes(val)
        ) {
          warnings.push({
            topic: 'Configuration Error',
            message: `Invalid value \`${val}\` for \`${currentPath}\`. The allowed values are ${configFileNames.join(', ')}.`,
          });
        } else if (
          key === 'repositoryCache' &&
          !['enabled', 'disabled', 'reset'].includes(val)
        ) {
          warnings.push({
            topic: 'Configuration Error',
            message: `Invalid value \`${val}\` for \`${currentPath}\`. The allowed values are ${['enabled', 'disabled', 'reset'].join(', ')}.`,
          });
        } else if (
          key === 'dryRun' &&
          !['extract', 'lookup', 'full'].includes(val)
        ) {
          warnings.push({
            topic: 'Configuration Error',
            message: `Invalid value \`${val}\` for \`${currentPath}\`. The allowed values are ${['extract', 'lookup', 'full'].join(', ')}.`,
          });
        } else if (
          key === 'binarySource' &&
          !['docker', 'global', 'install', 'hermit'].includes(val)
        ) {
          warnings.push({
            topic: 'Configuration Error',
            message: `Invalid value \`${val}\` for \`${currentPath}\`. The allowed values are ${['docker', 'global', 'install', 'hermit'].join(', ')}.`,
          });
        } else if (
          key === 'requireConfig' &&
          !['required', 'optional', 'ignored'].includes(val)
        ) {
          warnings.push({
            topic: 'Configuration Error',
            message: `Invalid value \`${val}\` for \`${currentPath}\`. The allowed values are ${['required', 'optional', 'ignored'].join(', ')}.`,
          });
        } else if (
          key === 'gitUrl' &&
          !['default', 'ssh', 'endpoint'].includes(val)
        ) {
          warnings.push({
            topic: 'Configuration Error',
            message: `Invalid value \`${val}\` for \`${currentPath}\`. The allowed values are ${['default', 'ssh', 'endpoint'].join(', ')}.`,
          });
        }

        if (
          key === 'reportType' &&
          ['s3', 'file'].includes(val) &&
          !is.string(config.reportPath)
        ) {
          errors.push({
            topic: 'Configuration Error',
            message: `reportType '${val}' requires a configured reportPath`,
          });
        }
      } else {
        warnings.push({
          topic: 'Configuration Error',
          message: `Configuration option \`${currentPath}\` should be a string.`,
        });
      }
    } else if (type === 'integer') {
      const allowsNegative = optionAllowsNegativeIntegers.has(key);
      warnings.push(...validateNumber(key, val, allowsNegative, currentPath));
    } else if (type === 'boolean') {
      if (val !== true && val !== false) {
        warnings.push({
          topic: 'Configuration Error',
          message: `Configuration option \`${currentPath}\` should be a boolean. Found: ${JSON.stringify(
            val,
          )} (${typeof val}).`,
        });
      }
    } else if (type === 'array') {
      if (is.array(val)) {
        if (isRegexOrGlobOption(key)) {
          warnings.push(
            ...regexOrGlobValidator.check({
              val,
              currentPath: currentPath!,
            }),
          );
        }
        if (key === 'gitNoVerify') {
          const allowedValues = ['commit', 'push'];
          for (const value of val as string[]) {
            if (!allowedValues.includes(value)) {
              warnings.push({
                topic: 'Configuration Error',
                message: `Invalid value for \`${currentPath}\`. The allowed values are ${allowedValues.join(', ')}.`,
              });
            }
          }
        }
        if (key === 'mergeConfidenceDatasources') {
          const allowedValues = supportedDatasources;
          for (const value of val as string[]) {
            if (!allowedValues.includes(value)) {
              warnings.push({
                topic: 'Configuration Error',
                message: `Invalid value \`${value}\` for \`${currentPath}\`. The allowed values are ${allowedValues.join(', ')}.`,
              });
            }
          }
        }
      } else {
        warnings.push({
          topic: 'Configuration Error',
          message: `Configuration option \`${currentPath}\` should be a list (Array).`,
        });
      }
    } else if (type === 'object') {
      if (is.plainObject(val)) {
        if (key === 'onboardingConfig') {
          const subValidation = await validateConfig('repo', val);
          for (const warning of subValidation.warnings.concat(
            subValidation.errors,
          )) {
            warnings.push(warning);
          }
        } else if (key === 'force') {
          const subValidation = await validateConfig('global', val);
          for (const warning of subValidation.warnings.concat(
            subValidation.errors,
          )) {
            warnings.push(warning);
          }
        } else if (key === 'cacheTtlOverride') {
          for (const [subKey, subValue] of Object.entries(val)) {
            const allowsNegative = optionAllowsNegativeIntegers.has(key);
            warnings.push(
              ...validateNumber(
                key,
                subValue,
                allowsNegative,
                currentPath,
                subKey,
              ),
            );
          }
        } else {
          const res = validatePlainObject(val);
          if (res !== true) {
            warnings.push({
              topic: 'Configuration Error',
              message: `Invalid \`${currentPath}.${res}\` configuration: value must be a string.`,
            });
          }
        }
      } else {
        warnings.push({
          topic: 'Configuration Error',
          message: `Configuration option \`${currentPath}\` should be a JSON object.`,
        });
      }
    }
  }
}
