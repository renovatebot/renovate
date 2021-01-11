import is from '@sindresorhus/is';
import {
  CONFIG_VALIDATION,
  PLATFORM_RATE_LIMIT_EXCEEDED,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { regEx } from '../../util/regex';
import { RenovateConfig } from '../common';
import * as massage from '../massage';
import * as migration from '../migration';
import { mergeChildConfig } from '../utils';
import { PresetApi } from './common';
import * as gitea from './gitea';
import * as github from './github';
import * as gitlab from './gitlab';
import * as internal from './internal';
import * as local from './local';
import * as npm from './npm';

const presetSources: Record<string, PresetApi> = {
  github,
  npm,
  gitlab,
  gitea,
  local,
  internal,
};

export function replaceArgs(
  obj: string | string[] | Record<string, any> | Record<string, any>[],
  argMapping: Record<string, any>
): any {
  if (is.string(obj)) {
    let returnStr = obj;
    for (const [arg, argVal] of Object.entries(argMapping)) {
      const re = regEx(`{{${arg}}}`, 'g');
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
  let packageName: string;
  let presetName: string;
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
  str = str.replace(/^npm>/, '');
  presetSource = presetSource || 'npm';
  if (str.includes('(')) {
    params = str
      .slice(str.indexOf('(') + 1, -1)
      .split(',')
      .map((elem) => elem.trim());
    str = str.slice(0, str.indexOf('('));
  }
  const presetsPackages = [
    'config',
    'default',
    'docker',
    'group',
    'helpers',
    'monorepo',
    'npm',
    'packages',
    'preview',
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
    [, packageName] = /(@.*?)(:|$)/.exec(str);
    str = str.slice(packageName.length);
    if (!packageName.includes('/')) {
      packageName += '/renovate-config';
    }
    if (str === '') {
      presetName = 'default';
    } else {
      presetName = str.slice(1);
    }
  } else {
    // non-scoped namespace
    [, packageName] = /(.*?)(:|$)/.exec(str);
    presetName = str.slice(packageName.length + 1);
    if (presetSource === 'npm' && !packageName.startsWith('renovate-config-')) {
      packageName = `renovate-config-${packageName}`;
    }
    if (presetName === '') {
      presetName = 'default';
    }
  }
  return { presetSource, packageName, presetName, params };
}

export async function getPreset(
  preset: string,
  baseConfig?: RenovateConfig
): Promise<RenovateConfig> {
  logger.trace(`getPreset(${preset})`);
  const { presetSource, packageName, presetName, params } = parsePreset(preset);
  let presetConfig = await presetSources[presetSource].getPreset({
    packageName,
    presetName,
    baseConfig,
  });
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
  ];
  if (presetKeys.every((key) => packageListKeys.includes(key))) {
    delete presetConfig.description;
  }
  const { migratedConfig } = migration.migrateConfig(presetConfig);
  return massage.massageConfig(migratedConfig);
}

export async function resolveConfigPresets(
  inputConfig: RenovateConfig,
  baseConfig?: RenovateConfig,
  ignorePresets?: string[],
  existingPresets: string[] = []
): Promise<RenovateConfig> {
  if (!ignorePresets || ignorePresets.length === 0) {
    ignorePresets = inputConfig.ignorePresets || []; // eslint-disable-line
  }
  logger.trace(
    { config: inputConfig, existingPresets },
    'resolveConfigPresets'
  );
  let config: RenovateConfig = {};
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
          fetchedPreset = await getPreset(preset, baseConfig);
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
          if (err.message === 'dep not found') {
            error.validationError = `Cannot find preset's package (${preset})`;
          } else if (err.message === 'preset renovate-config not found') {
            error.validationError = `Preset package is missing a renovate-config entry (${preset})`;
          } else if (err.message === 'preset not found') {
            error.validationError = `Preset name not found within published preset config (${preset})`;
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

export interface ParsedPreset {
  presetSource: string;
  packageName: string;
  presetName: string;
  params?: string[];
}
