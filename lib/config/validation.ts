import is from '@sindresorhus/is';
import { getLanguageList, getManagerList } from '../manager';
import { configRegexPredicate, isConfigRegex, regEx } from '../util/regex';
import * as template from '../util/template';
import { hasValidSchedule, hasValidTimezone } from '../workers/branch/schedule';
import { getOptions } from './definitions';
import { resolveConfigPresets } from './presets';
import type {
  RenovateConfig,
  RenovateOptions,
  ValidationMessage,
} from './types';
import * as managerValidator from './validation-helpers/managers';

const options = getOptions();

let optionTypes: Record<string, RenovateOptions['type']>;
let optionParents: Record<string, RenovateOptions['parent']>;

export interface ValidationResult {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

const managerList = getManagerList();

function isManagerPath(parentPath: string): boolean {
  return (
    /^regexManagers\[[0-9]+]$/.test(parentPath) ||
    managerList.includes(parentPath)
  );
}

export function getParentName(parentPath: string): string {
  return parentPath
    ? parentPath
        .replace(/\.?encrypted$/, '')
        .replace(/\[\d+\]$/, '')
        .split('.')
        .pop()
    : '.';
}

const topLevelObjects = getLanguageList().concat(getManagerList());

export async function validateConfig(
  config: RenovateConfig,
  isPreset?: boolean,
  parentPath?: string
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

  function getDeprecationMessage(option: string): string {
    const deprecatedOptions = {
      branchName: `Direct editing of branchName is now deprecated. Please edit branchPrefix, additionalBranchPrefix, or branchTopic instead`,
      commitMessage: `Direct editing of commitMessage is now deprecated. Please edit commitMessage's subcomponents instead.`,
      prTitle: `Direct editing of prTitle is now deprecated. Please edit commitMessage subcomponents instead as they will be passed through to prTitle.`,
      yarnrc:
        'Use of `yarnrc` in config is deprecated. Please commit it to your repository instead.',
    };
    return deprecatedOptions[option];
  }

  function isIgnored(key: string): boolean {
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
    ];
    return ignoredNodes.includes(key);
  }

  function validateAliasObject(
    key: string,
    val: Record<string, unknown>
  ): boolean {
    if (key === 'aliases') {
      for (const value of Object.values(val)) {
        if (!is.urlString(value)) {
          return false;
        }
      }
    }
    return true;
  }

  function getUnsupportedEnabledManagers(enabledManagers: string[]): string[] {
    return enabledManagers.filter(
      (manager) => !getManagerList().includes(manager)
    );
  }

  for (const [key, val] of Object.entries(config)) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    // istanbul ignore if
    if (key === '__proto__') {
      errors.push({
        topic: 'Config security error',
        message: '__proto__',
      });
      continue; // eslint-disable-line
    }
    if (parentPath && topLevelObjects.includes(key)) {
      errors.push({
        topic: 'Configuration Error',
        message: `The "${key}" object can only be configured at the top level of a config but was found inside "${parentPath}"`,
      });
    }
    if (key === 'enabledManagers' && val) {
      const unsupportedManagers = getUnsupportedEnabledManagers(
        val as string[]
      );
      if (is.nonEmptyArray(unsupportedManagers)) {
        errors.push({
          topic: 'Configuration Error',
          message: `The following managers configured in enabledManagers are not supported: "${unsupportedManagers.join(
            ', '
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
          message: getDeprecationMessage(key),
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
          let res = template.compile(val.toString(), config, false);
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
      } else if (key === 'timezone' && val !== null) {
        const [validTimezone, errorMessage] = hasValidTimezone(val as string);
        if (!validTimezone) {
          errors.push({
            topic: 'Configuration Error',
            message: `${currentPath}: ${errorMessage}`,
          });
        }
      } else if (val != null) {
        const type = optionTypes[key];
        if (type === 'boolean') {
          if (val !== true && val !== false) {
            errors.push({
              topic: 'Configuration Error',
              message: `Configuration option \`${currentPath}\` should be boolean. Found: ${JSON.stringify(
                val
              )} (${typeof val})`,
            });
          }
        } else if (type === 'array' && val) {
          if (is.array(val)) {
            for (const [subIndex, subval] of val.entries()) {
              if (is.object(subval)) {
                const subValidation = await module.exports.validateConfig(
                  subval,
                  isPreset,
                  `${currentPath}[${subIndex}]`
                );
                warnings = warnings.concat(subValidation.warnings);
                errors = errors.concat(subValidation.errors);
              }
            }
            if (key === 'extends') {
              const tzRe = /^:timezone\((.+)\)$/;
              for (const subval of val) {
                if (is.string(subval)) {
                  if (tzRe.test(subval)) {
                    const [, timezone] = tzRe.exec(subval);
                    const [validTimezone, errorMessage] = hasValidTimezone(
                      timezone
                    );
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
              'matchFiles',
              'matchPaths',
              'matchLanguages',
              'matchBaseBranches',
              'matchManagers',
              'matchDatasources',
              'matchDepTypes',
              'matchPackageNames',
              'matchPackagePatterns',
              'matchPackagePrefixes',
              'excludePackageNames',
              'excludePackagePatterns',
              'excludePackagePrefixes',
              'matchCurrentVersion',
              'matchSourceUrlPrefixes',
              'matchUpdateTypes',
            ];
            if (key === 'packageRules') {
              for (const [subIndex, packageRule] of val.entries()) {
                if (is.object(packageRule)) {
                  const resolvedRule = await resolveConfigPresets(
                    packageRule as RenovateConfig,
                    config
                  );
                  errors.push(
                    ...managerValidator.check({ resolvedRule, currentPath })
                  );
                  const selectorLength = Object.keys(
                    resolvedRule
                  ).filter((ruleKey) => selectors.includes(ruleKey)).length;
                  if (!selectorLength) {
                    const message = `${currentPath}[${subIndex}]: Each packageRule must contain at least one match* or exclude* selector. Rule: ${JSON.stringify(
                      packageRule
                    )}`;
                    errors.push({
                      topic: 'Configuration Error',
                      message,
                    });
                  }
                  if (selectorLength === Object.keys(resolvedRule).length) {
                    const message = `${currentPath}[${subIndex}]: Each packageRule must contain at least one non-match* or non-exclude* field. Rule: ${JSON.stringify(
                      packageRule
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
                          packageRule
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
            if (key === 'regexManagers') {
              const allowedKeys = [
                'description',
                'fileMatch',
                'matchStrings',
                'matchStringsStrategy',
                'depNameTemplate',
                'lookupNameTemplate',
                'datasourceTemplate',
                'versioningTemplate',
                'registryUrlTemplate',
              ];
              // TODO: fix types
              for (const regexManager of val as any[]) {
                if (
                  Object.keys(regexManager).some(
                    (k) => !allowedKeys.includes(k)
                  )
                ) {
                  const disallowedKeys = Object.keys(regexManager).filter(
                    (k) => !allowedKeys.includes(k)
                  );
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Regex Manager contains disallowed fields: ${disallowedKeys.join(
                      ', '
                    )}`,
                  });
                } else if (is.nonEmptyArray(regexManager.fileMatch)) {
                  let validRegex = false;
                  for (const matchString of regexManager.matchStrings) {
                    try {
                      regEx(matchString);
                      validRegex = true;
                    } catch (e) {
                      errors.push({
                        topic: 'Configuration Error',
                        message: `Invalid regExp for ${currentPath}: \`${String(
                          matchString
                        )}\``,
                      });
                    }
                  }
                  if (validRegex) {
                    const mandatoryFields = [
                      'depName',
                      'currentValue',
                      'datasource',
                    ];
                    for (const field of mandatoryFields) {
                      if (
                        !regexManager[`${field}Template`] &&
                        !regexManager.matchStrings.some((matchString) =>
                          matchString.includes(`(?<${field}>`)
                        )
                      ) {
                        errors.push({
                          topic: 'Configuration Error',
                          message: `Regex Managers must contain ${field}Template configuration or regex group named ${field}`,
                        });
                      }
                    }
                  }
                } else {
                  errors.push({
                    topic: 'Configuration Error',
                    message: `Each Regex Manager must contain a fileMatch array`,
                  });
                }
              }
            }
            if (
              key === 'matchPackagePatterns' ||
              key === 'excludePackagePatterns'
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
            if (
              (selectors.includes(key) || key === 'matchCurrentVersion') &&
              !/p.*Rules\[\d+\]$/.test(parentPath) && // Inside a packageRule
              (parentPath || !isPreset) // top level in a preset
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
            if (key === 'aliases') {
              if (!validateAliasObject(key, val)) {
                errors.push({
                  topic: 'Configuration Error',
                  message: `Invalid alias object configuration`,
                });
              }
            } else {
              const ignoredObjects = options
                .filter((option) => option.freeChoice)
                .map((option) => option.name);
              if (!ignoredObjects.includes(key)) {
                const subValidation = await module.exports.validateConfig(
                  val,
                  isPreset,
                  currentPath
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
