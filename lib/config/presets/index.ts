import is from '@sindresorhus/is';
import {
  CONFIG_VALIDATION,
  PLATFORM_RATE_LIMIT_EXCEEDED,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { clone } from '../../util/clone';
import { regEx } from '../../util/regex';
import * as massage from '../massage';
import * as migration from '../migration';
import type { AllConfig, RenovateConfig } from '../types';
import { mergeChildConfig } from '../utils';
import { removedPresets } from './common';
import * as gitea from './gitea';
import * as github from './github';
import * as gitlab from './gitlab';
import * as internal from './internal';
import * as local from './local';
import * as npm from './npm';
import type { ParsedPreset, PresetApi } from './types';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID,
  PRESET_NOT_FOUND,
  PRESET_PROHIBITED_SUBPRESET,
  PRESET_RENOVATE_CONFIG_NOT_FOUND,
} from './util';

const presetSources: Record<string, PresetApi> = {
  github,
  npm,
  gitlab,
  gitea,
  local,
  internal,
};

const nonScopedPresetWithSubdirRegex = regEx(
  /^(?<packageName>~?[\w\-./]+?)\/\/(?:(?<presetPath>[\w\-./]+)\/)?(?<presetName>[\w\-.]+)(?:#(?<packageTag>[\w\-./]+?))?$/
);
const gitPresetRegex = regEx(
  /^(?<packageName>~?[\w\-. /]+)(?::(?<presetName>[\w\-.+/]+))?(?:#(?<packageTag>[\w\-./]+?))?$/
);

export function replaceArgs(
  obj: string | string[] | Record<string, any> | Record<string, any>[],
  argMapping: Record<string, any>
): any {
  if (is.string(obj)) {
    let returnStr = obj;
    for (const [arg, argVal] of Object.entries(argMapping)) {
      const re = regEx(`{{${arg}}}`, 'g', false);
      returnStr = returnStr.replace(re, argVal);
    }
    return returnStr;
  }
  if (is.array(obj)) {
    const returnArray = [];
    for (const item of obj) {
      returnArray.push(replaceArgs(item, argMapping));
    }
    return returnArray;
  }
  if (is.object(obj)) {
    const returnObj = {};
    for (const [key, val] of Object.entries(obj)) {
      returnObj[key] = replaceArgs(val, argMapping);
    }
    return returnObj;
  }
  return obj;
}

export function parsePreset(input: string): ParsedPreset {
  let str = input;
  let presetSource: string;
  let presetPath: string | undefined;
  let packageName: string;
  let presetName: string;
  let packageTag: string | undefined;
  let params: string[];
  if (str.startsWith('github>')) {
    presetSource = 'github';
    str = str.substring('github>'.length);
  } else if (str.startsWith('gitlab>')) {
    presetSource = 'gitlab';
    str = str.substring('gitlab>'.length);
  } else if (str.startsWith('gitea>')) {
    presetSource = 'gitea';
    str = str.substring('gitea>'.length);
  } else if (str.startsWith('local>')) {
    presetSource = 'local';
    str = str.substring('local>'.length);
  } else if (
    !str.startsWith('@') &&
    !str.startsWith(':') &&
    str.includes('/')
  ) {
    presetSource = 'local';
  }
  str = str.replace(regEx(/^npm>/), '');
  presetSource = presetSource || 'npm';
  if (str.includes('(')) {
    params = str
      .slice(str.indexOf('(') + 1, -1)
      .split(',')
      .map((elem) => elem.trim());
    str = str.slice(0, str.indexOf('('));
  }
  const presetsPackages = [
    'compatibility',
    'config',
    'default',
    'docker',
    'group',
    'helpers',
    'monorepo',
    'npm',
    'packages',
    'preview',
    'regexManagers',
    'replacements',
    'schedule',
    'workarounds',
  ];
  if (
    presetsPackages.some((presetPackage) => str.startsWith(`${presetPackage}:`))
  ) {
    presetSource = 'internal';
    [packageName, presetName] = str.split(':');
  } else if (str.startsWith(':')) {
    // default namespace
    presetSource = 'internal';
    packageName = 'default';
    presetName = str.slice(1);
  } else if (str.startsWith('@')) {
    // scoped namespace
    [, packageName] = regEx(/(@.*?)(:|$)/).exec(str);
    str = str.slice(packageName.length);
    if (!packageName.includes('/')) {
      packageName += '/renovate-config';
    }
    if (str === '') {
      presetName = 'default';
    } else {
      presetName = str.slice(1);
    }
  } else if (str.includes('//')) {
    // non-scoped namespace with a subdirectory preset

    // Validation
    if (str.includes(':')) {
      throw new Error(PRESET_PROHIBITED_SUBPRESET);
    }
    if (!nonScopedPresetWithSubdirRegex.test(str)) {
      throw new Error(PRESET_INVALID);
    }
    ({ packageName, presetPath, presetName, packageTag } =
      nonScopedPresetWithSubdirRegex.exec(str)?.groups || {});
  } else {
    ({ packageName, presetName, packageTag } =
      gitPresetRegex.exec(str)?.groups || {});

    if (presetSource === 'npm' && !packageName.startsWith('renovate-config-')) {
      packageName = `renovate-config-${packageName}`;
    }
    if (!is.nonEmptyString(presetName)) {
      presetName = 'default';
    }
  }

  return {
    presetSource,
    presetPath,
    packageName,
    presetName,
    packageTag,
    params,
  };
}

export async function getPreset(
  preset: string,
  baseConfig?: RenovateConfig
): Promise<RenovateConfig> {
  logger.trace(`getPreset(${preset})`);
  // Check if the preset has been removed or replaced
  const newPreset = removedPresets[preset];
  if (newPreset) {
    return getPreset(newPreset, baseConfig);
  }
  if (newPreset === null) {
    return {};
  }
  const {
    presetSource,
    packageName,
    presetPath,
    presetName,
    packageTag,
    params,
  } = parsePreset(preset);
  let presetConfig = await presetSources[presetSource].getPreset({
    packageName,
    presetPath,
    presetName,
    baseConfig,
    packageTag,
  });
  if (!presetConfig) {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
  logger.trace({ presetConfig }, `Found preset ${preset}`);
  if (params) {
    const argMapping = {};
    for (const [index, value] of params.entries()) {
      argMapping[`arg${index}`] = value;
    }
    presetConfig = replaceArgs(presetConfig, argMapping);
  }
  logger.trace({ presetConfig }, `Applied params to preset ${preset}`);
  const presetKeys = Object.keys(presetConfig);
  // istanbul ignore if
  if (
    presetKeys.length === 2 &&
    presetKeys.includes('description') &&
    presetKeys.includes('extends')
  ) {
    // preset is just a collection of other presets
    delete presetConfig.description;
  }
  const packageListKeys = [
    'description',
    'matchPackageNames',
    'excludePackageNames',
    'matchPackagePatterns',
    'excludePackagePatterns',
    'matchPackagePrefixes',
    'excludePackagePrefixes',
  ];
  if (presetKeys.every((key) => packageListKeys.includes(key))) {
    delete presetConfig.description;
  }
  const { migratedConfig } = migration.migrateConfig(presetConfig);
  return massage.massageConfig(migratedConfig);
}

export async function resolveConfigPresets(
  inputConfig: AllConfig,
  baseConfig?: RenovateConfig,
  _ignorePresets?: string[],
  existingPresets: string[] = []
): Promise<AllConfig> {
  let ignorePresets = clone(_ignorePresets);
  if (!ignorePresets || ignorePresets.length === 0) {
    ignorePresets = inputConfig.ignorePresets || [];
  }
  logger.trace(
    { config: inputConfig, existingPresets },
    'resolveConfigPresets'
  );
  let config: AllConfig = {};
  // First, merge all the preset configs from left to right
  if (inputConfig.extends?.length) {
    for (const preset of inputConfig.extends) {
      // istanbul ignore if
      if (existingPresets.includes(preset)) {
        logger.debug(
          `Already seen preset ${preset} in [${existingPresets.join(', ')}]`
        );
      } else if (ignorePresets.includes(preset)) {
        // istanbul ignore next
        logger.debug(
          `Ignoring preset ${preset} in [${existingPresets.join(', ')}]`
        );
      } else {
        logger.trace(`Resolving preset "${preset}"`);
        let fetchedPreset: RenovateConfig;
        try {
          fetchedPreset = await getPreset(preset, baseConfig ?? inputConfig);
        } catch (err) {
          logger.debug({ preset, err }, 'Preset fetch error');
          // istanbul ignore if
          if (err instanceof ExternalHostError) {
            throw err;
          }
          // istanbul ignore if
          if (err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
            throw err;
          }
          const error = new Error(CONFIG_VALIDATION);
          if (err.message === PRESET_DEP_NOT_FOUND) {
            error.validationError = `Cannot find preset's package (${preset})`;
          } else if (err.message === PRESET_RENOVATE_CONFIG_NOT_FOUND) {
            error.validationError = `Preset package is missing a renovate-config entry (${preset})`;
          } else if (err.message === PRESET_NOT_FOUND) {
            error.validationError = `Preset name not found within published preset config (${preset})`;
          } else if (err.message === PRESET_INVALID) {
            error.validationError = `Preset is invalid (${preset})`;
          } else if (err.message === PRESET_PROHIBITED_SUBPRESET) {
            error.validationError = `Sub-presets cannot be combined with a custom path (${preset})`;
          }
          // istanbul ignore if
          if (existingPresets.length) {
            error.validationError +=
              '. Note: this is a *nested* preset so please contact the preset author if you are unable to fix it yourself.';
          }
          logger.info(
            { validationError: error.validationError },
            'Throwing preset error'
          );
          throw error;
        }
        const presetConfig = await resolveConfigPresets(
          fetchedPreset,
          baseConfig,
          ignorePresets,
          existingPresets.concat([preset])
        );
        // istanbul ignore if
        if (inputConfig?.ignoreDeps?.length === 0) {
          delete presetConfig.description;
        }
        config = mergeChildConfig(config, presetConfig);
      }
    }
  }
  logger.trace({ config }, `Post-preset resolve config`);
  // Now assign "regular" config on top
  config = mergeChildConfig(config, inputConfig);
  delete config.extends;
  delete config.ignorePresets;
  logger.trace({ config }, `Post-merge resolve config`);
  for (const [key, val] of Object.entries(config)) {
    const ignoredKeys = ['content', 'onboardingConfig'];
    if (is.array(val)) {
      // Resolve nested objects inside arrays
      config[key] = [];
      for (const element of val) {
        if (is.object(element)) {
          (config[key] as RenovateConfig[]).push(
            await resolveConfigPresets(
              element as RenovateConfig,
              baseConfig,
              ignorePresets,
              existingPresets
            )
          );
        } else {
          (config[key] as unknown[]).push(element);
        }
      }
    } else if (is.object(val) && !ignoredKeys.includes(key)) {
      // Resolve nested objects
      logger.trace(`Resolving object "${key}"`);
      config[key] = await resolveConfigPresets(
        val as RenovateConfig,
        baseConfig,
        ignorePresets,
        existingPresets
      );
    }
  }
  logger.trace({ config: inputConfig }, 'Input config');
  logger.trace({ config }, 'Resolved config');
  return config;
}
