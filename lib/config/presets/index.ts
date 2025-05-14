import is from '@sindresorhus/is';
import {
  CONFIG_VALIDATION,
  PLATFORM_RATE_LIMIT_EXCEEDED,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../../util/cache/memory';
import * as packageCache from '../../util/cache/package';
import { getTtlOverride } from '../../util/cache/package/ttl';
import { clone } from '../../util/clone';
import { regEx } from '../../util/regex';
import * as template from '../../util/template';
import { GlobalConfig } from '../global';
import * as massage from '../massage';
import * as migration from '../migration';
import type { AllConfig, RenovateConfig } from '../types';
import { mergeChildConfig } from '../utils';
import { removedPresets } from './common';
import * as gitea from './gitea';
import * as github from './github';
import * as gitlab from './gitlab';
import * as http from './http';
import * as internal from './internal';
import * as local from './local';
import * as npm from './npm';
import { parsePreset } from './parse';
import type { Preset, PresetApi } from './types';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID,
  PRESET_INVALID_JSON,
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
  http,
};

const presetCacheNamespace = 'preset';

export function replaceArgs(
  obj: string,
  argMapping: Record<string, any>,
): string;
export function replaceArgs(
  obj: string[],
  argMapping: Record<string, any>,
): string[];
export function replaceArgs(
  obj: Record<string, any>,
  argMapping: Record<string, any>,
): Record<string, any>;
export function replaceArgs(
  obj: Record<string, any>[],
  argMapping: Record<string, any>,
): Record<string, any>[];

/**
 * TODO: fix me #22198
 * @param obj
 * @param argMapping
 */
export function replaceArgs(obj: any, argMapping: Record<string, any>): any;
export function replaceArgs(
  obj: string | string[] | Record<string, any> | Record<string, any>[],
  argMapping: Record<string, any>,
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
    const returnObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      returnObj[key] = replaceArgs(val, argMapping);
    }
    return returnObj;
  }
  return obj;
}

export async function getPreset(
  preset: string,
  baseConfig?: RenovateConfig,
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
  const { presetSource, repo, presetPath, presetName, tag, params } =
    parsePreset(preset);
  const cacheKey = `preset:${preset}`;
  const presetCachePersistence = GlobalConfig.get(
    'presetCachePersistence',
    false,
  );

  let presetConfig: Preset | null | undefined;

  if (presetCachePersistence) {
    presetConfig = await packageCache.get(presetCacheNamespace, cacheKey);
  } else {
    presetConfig = memCache.get(cacheKey);
  }

  if (is.nullOrUndefined(presetConfig)) {
    presetConfig = await presetSources[presetSource].getPreset({
      repo,
      presetPath,
      presetName,
      tag,
    });
    if (presetCachePersistence) {
      await packageCache.set(
        presetCacheNamespace,
        cacheKey,
        presetConfig,
        getTtlOverride(presetCacheNamespace) ?? 15,
      );
    } else {
      memCache.set(cacheKey, presetConfig);
    }
  }
  if (!presetConfig) {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
  logger.trace({ presetConfig }, `Found preset ${preset}`);
  if (params) {
    const argMapping: Record<string, string> = {};
    for (const [index, value] of params.entries()) {
      argMapping[`arg${index}`] = value;
    }
    presetConfig = replaceArgs(presetConfig, argMapping);
  }
  logger.trace({ presetConfig }, `Applied params to preset ${preset}`);
  const presetKeys = Object.keys(presetConfig);
  if (
    presetKeys.length === 2 &&
    presetKeys.includes('description') &&
    presetKeys.includes('extends')
  ) {
    // preset is just a collection of other presets
    delete presetConfig.description;
  }
  const packageListKeys = ['description', 'matchPackageNames'];
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
  existingPresets: string[] = [],
): Promise<AllConfig> {
  let ignorePresets = clone(_ignorePresets);
  if (!ignorePresets || ignorePresets.length === 0) {
    ignorePresets = inputConfig.ignorePresets ?? [];
  }
  logger.trace(
    { config: inputConfig, existingPresets },
    'resolveConfigPresets',
  );
  let config: AllConfig = {};
  // First, merge all the preset configs from left to right
  if (inputConfig.extends?.length) {
    // Compile templates
    inputConfig.extends = inputConfig.extends.map((tmpl) =>
      template.compile(tmpl, {}),
    );
    for (const preset of inputConfig.extends) {
      if (shouldResolvePreset(preset, existingPresets, ignorePresets)) {
        logger.trace(`Resolving preset "${preset}"`);
        const fetchedPreset = await fetchPreset(
          preset,
          baseConfig,
          inputConfig,
          existingPresets,
        );
        const presetConfig = await resolveConfigPresets(
          fetchedPreset,
          baseConfig ?? inputConfig,
          ignorePresets,
          existingPresets.concat([preset]),
        );
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
              existingPresets,
            ),
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
        existingPresets,
      );
    }
  }
  logger.trace({ config: inputConfig }, 'Input config');
  logger.trace({ config }, 'Resolved config');
  return config;
}

async function fetchPreset(
  preset: string,
  baseConfig: RenovateConfig | undefined,
  inputConfig: AllConfig,
  existingPresets: string[],
): Promise<AllConfig> {
  try {
    return await getPreset(preset, baseConfig ?? inputConfig);
  } catch (err) {
    logger.debug({ preset, err }, 'Preset fetch error');
    if (err instanceof ExternalHostError) {
      throw err;
    }
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
    } else if (err.message === PRESET_INVALID_JSON) {
      error.validationError = `Preset is invalid JSON (${preset})`;
    } else {
      error.validationError = `Preset caused unexpected error (${preset})`;
    }
    if (existingPresets.length) {
      error.validationError +=
        '. Note: this is a *nested* preset so please contact the preset author if you are unable to fix it yourself.';
    }
    logger.info(
      { validationError: error.validationError },
      'Throwing preset error',
    );
    throw error;
  }
}

function shouldResolvePreset(
  preset: string,
  existingPresets: string[],
  ignorePresets: string[],
): boolean {
  if (existingPresets.includes(preset)) {
    logger.debug(
      `Already seen preset ${preset} in [${existingPresets.join(', ')}]`,
    );
    return false;
  }
  if (ignorePresets.includes(preset)) {
    logger.debug(
      `Ignoring preset ${preset} in [${existingPresets.join(', ')}]`,
    );
    return false;
  }
  return true;
}
