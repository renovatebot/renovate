import {
  isArray,
  isNullOrUndefined,
  isObject,
  isString,
  isTruthy,
} from '@sindresorhus/is';
import {
  CONFIG_VALIDATION,
  HOST_BLOCKED,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
} from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import { sanitizeUrls } from '../../logger/utils.ts';
import { ExternalHostError } from '../../types/errors/external-host-error.ts';
import { coerceArray } from '../../util/array.ts';
import * as memCache from '../../util/cache/memory/index.ts';
import { buildCacheKey } from '../../util/cache/package/key.ts';
import { clone } from '../../util/clone.ts';
import { formatMarkdownList } from '../../util/markdown-list.ts';
import { regEx } from '../../util/regex.ts';
import * as template from '../../util/template/index.ts';
import { GlobalConfig } from '../global.ts';
import * as massage from '../massage.ts';
import * as migration from '../migration.ts';
import type { AllConfig, RenovateConfig } from '../types.ts';
import { mergeChildConfig } from '../utils.ts';
import { removedPresets } from './common.ts';
import * as internal from './internal/index.ts';
import { parsePreset } from './parse.ts';
import { canonicalizeRelativePresets } from './relative.ts';
import type { Preset, PresetApi } from './types.ts';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID,
  PRESET_INVALID_JSON,
  PRESET_NOT_FOUND,
  PRESET_PROHIBITED_SUBPRESET,
  PRESET_RELATIVE_NO_PARENT,
  PRESET_RENOVATE_CONFIG_NOT_FOUND,
} from './util.ts';

interface PresetSource {
  load: () => Promise<PresetApi>;

  /**
   * Whether presets from this source are hosted in a repository, which is what
   * allows them to reference other presets relatively.
   */
  repoHosted: boolean;
}

export const presetSources: Record<string, PresetSource> = {
  forgejo: { load: () => import('./forgejo/index.ts'), repoHosted: true },
  gitea: { load: () => import('./gitea/index.ts'), repoHosted: true },
  github: { load: () => import('./github/index.ts'), repoHosted: true },
  gitlab: { load: () => import('./gitlab/index.ts'), repoHosted: true },
  http: { load: () => import('./http/index.ts'), repoHosted: false },
  local: { load: () => import('./local/index.ts'), repoHosted: true },
  npm: { load: () => import('./npm/index.ts'), repoHosted: false },
};

const presetCacheNamespace = 'preset';

/**
 * A preset which could not be resolved.
 */
class PresetError extends Error {
  override validationSource: string;

  /** Where the preset is included: via a chain of presets, or `undefined` when included directly. */
  readonly inclusions: (PresetInclusion | undefined)[] = [];

  /** Further detail about why the preset could not be resolved. */
  details: string[] = [];

  constructor(preset: string) {
    super(CONFIG_VALIDATION);
    // presets may be URLs, which could include credentials
    this.validationSource = sanitizeUrls(preset);
  }

  /**
   * Describe why the preset could not be resolved, and where else it's included.
   */
  describe(): string | undefined {
    const nested = this.inclusions.filter(isTruthy);
    const notes = nested.map(
      ({ chain }) => `It is also included via ${chain}.`,
    );
    // only a preset which isn't also included directly needs its parent's author to fix it
    if (nested.length && !this.inclusions.includes(undefined)) {
      const [{ chain, parent }] = nested;
      notes[0] = `This is a *nested* preset, included via ${chain}, so please contact the author of ${parent} if you are unable to fix it yourself.`;
    }
    const paragraphs = [...this.details, ...notes];
    return paragraphs.length ? paragraphs.join('\n\n') : undefined;
  }
}

interface PresetInclusion {
  /** The chain of presets, from the config, which includes the preset. */
  chain: string;
  /** The preset which directly includes the preset. */
  parent: string;
}

/**
 * Several presets which could not be resolved.
 */
class PresetErrors extends Error {
  readonly errors: PresetError[];

  constructor(errors: PresetError[]) {
    super(CONFIG_VALIDATION);
    this.errors = errors;
    // each preset's `validationSource` is already sanitized
    this.validationSource = errors.map((e) => e.validationSource);
    this.validationError = 'Several presets could not be resolved';
    this.validationMessage = formatMarkdownList(
      errors.map((e) => {
        const description = e.describe();
        return description
          ? `\`${e.validationSource}\`: ${e.validationError}\n\n${description}`
          : `\`${e.validationSource}\`: ${e.validationError}`;
      }),
    );
  }
}

/**
 * Add a preset error to `presetErrors`, skipping any already added, or rethrow any other error.
 */
function collectPresetError(presetErrors: PresetError[], err: unknown): void {
  // any other error, such as a host being unavailable, may be temporary, so is rethrown even when presets could not be resolved, so the run can be retried
  if (!(err instanceof PresetError || err instanceof PresetErrors)) {
    throw err;
  }
  for (const e of err instanceof PresetErrors ? err.errors : [err]) {
    // the same preset may be included by several others, so is only reported once, noting where else it's included
    const seen = presetErrors.find(
      (p) =>
        p.validationSource === e.validationSource &&
        p.validationError === e.validationError,
    );
    if (seen) {
      const newInclusions = e.inclusions.filter(
        (inclusion) =>
          !seen.inclusions.some((i) => i?.chain === inclusion?.chain),
      );
      seen.inclusions.push(...newInclusions);
    } else {
      presetErrors.push(e);
    }
  }
}

/**
 * Run `resolve`, returning an empty result if a preset could not be resolved, after adding it to `presetErrors`.
 */
async function tryResolve(
  presetErrors: PresetError[],
  resolve: () => Promise<ResolveConfigPresetsResult>,
): Promise<ResolveConfigPresetsResult> {
  try {
    return await resolve();
  } catch (err) {
    collectPresetError(presetErrors, err);
    // the result is unused, as the preset errors are thrown once all presets have been tried
    return { config: {}, visitedPresets: { merged: [], unmerged: [] } };
  }
}

/**
 * Throw the preset errors, as a single error if there's only one.
 */
function throwPresetErrors(presetErrors: PresetError[]): never {
  if (presetErrors.length === 1) {
    const [error] = presetErrors;
    error.validationMessage = error.describe();
    throw error;
  }
  throw new PresetErrors(presetErrors);
}

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
  if (isString(obj)) {
    let returnStr = obj;
    for (const [arg, argVal] of Object.entries(argMapping)) {
      const re = regEx(`{{${arg}}}`, 'g', false);
      returnStr = returnStr.replace(re, argVal);
    }
    return returnStr;
  }
  if (isArray(obj)) {
    const returnArray = [];
    for (const item of obj) {
      returnArray.push(replaceArgs(item, argMapping));
    }
    return returnArray;
  }
  if (isObject(obj)) {
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
  const parsedPreset = parsePreset(preset);
  const { presetSource, repo, presetPath, presetName, tag, params, rawParams } =
    parsedPreset;

  if (presetSource === 'relative') {
    throw new Error(PRESET_RELATIVE_NO_PARENT);
  }

  let presetConfig: Preset | null | undefined;

  if (presetSource === 'internal') {
    presetConfig = internal.getPreset({
      repo,
      presetPath,
      presetName,
      tag,
    });
  } else {
    const cacheKey = buildCacheKey('preset', preset);
    const presetCachePersistence = GlobalConfig.get('presetCachePersistence');

    const packageCache = presetCachePersistence
      ? await import('../../util/cache/package/index.ts')
      : undefined;

    if (packageCache) {
      presetConfig = await packageCache.get(presetCacheNamespace, cacheKey);
    } else {
      presetConfig = memCache.get(cacheKey);
    }

    if (isNullOrUndefined(presetConfig)) {
      const source = await presetSources[presetSource].load();
      presetConfig = await source.getPreset({
        repo,
        presetPath,
        presetName,
        tag,
      });
      if (packageCache) {
        await packageCache.set(
          presetCacheNamespace,
          cacheKey,
          presetConfig,
          15,
        );
      } else {
        memCache.set(cacheKey, presetConfig);
      }
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
    if (rawParams) {
      argMapping.args = rawParams;
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
  const massagedConfig = massage.massageConfig(migratedConfig);
  if (presetSources[parsedPreset.presetSource]?.repoHosted) {
    // only presets which are hosted in a repository can contain relative
    // references, in all other presets they are left as they are and fail
    // when they are resolved
    canonicalizeRelativePresets(massagedConfig, parsedPreset);
  }
  return massagedConfig;
}

export interface ResolveConfigPresetsResult {
  config: AllConfig;
  /** when resolving the given configuration, which internal/shared presets were discovered */
  visitedPresets: {
    /** which internal/shared presets were merged into the final config */
    merged: string[];
    /** which internal/shared presets were not merged into the final config */
    unmerged: string[];
  };
}

/**
 * @param [mergeInternalPresets=true] when resolving the config presets, whether to merge Renovate internal presets into the resulting configuration.
 *   When set to `false`, this will resolve these internal presets (recursively), but not merge them.
 *   This is primarily intended to be used by "shallow config" resolution (for logging purposes).
 */
export function resolveConfigPresets(
  inputConfig: AllConfig,
  baseConfig?: RenovateConfig,
  _ignorePresets?: string[],
  existingPresets: string[] = [],
  mergeInternalPresets = true,
): Promise<ResolveConfigPresetsResult> {
  return resolvePresets(
    inputConfig,
    baseConfig,
    _ignorePresets,
    existingPresets,
    mergeInternalPresets,
    new Map(),
  );
}

/**
 * Resolve presets, as `resolveConfigPresets`, remembering the presets which could not be fetched in `failedPresets`.
 */
async function resolvePresets(
  inputConfig: AllConfig,
  baseConfig: RenovateConfig | undefined,
  _ignorePresets: string[] | undefined,
  existingPresets: string[],
  mergeInternalPresets: boolean,
  failedPresets: Map<string, Error>,
): Promise<ResolveConfigPresetsResult> {
  const allVisitedPresets = {
    merged: new Set<string>(),
    unmerged: new Set<string>(),
  };

  let ignorePresets = clone(_ignorePresets);
  if (!ignorePresets || ignorePresets.length === 0) {
    ignorePresets = coerceArray(inputConfig.ignorePresets);
  }
  logger.trace(
    { config: inputConfig, existingPresets, mergeInternalPresets },
    'resolveConfigPresets',
  );

  let config: AllConfig = {};
  // presets which could not be resolved, which are reported once all presets have been tried
  const presetErrors: PresetError[] = [];
  // First, merge all the preset configs from left to right
  if (inputConfig.extends?.length) {
    // Compile templates
    inputConfig.extends = inputConfig.extends.map((tmpl) =>
      template.compile(tmpl, {}),
    );
    for (const preset of inputConfig.extends) {
      // don't attempt to merge any internal presets if we're not expecting to
      if (!mergeInternalPresets && internal.isInternal(preset)) {
        logger.once.trace(
          { ignoredPreset: preset, mergeInternalPresets },
          'Not merging preset',
        );
        // ... but make sure we note that we haven't resolved it
        allVisitedPresets.unmerged.add(preset);
        continue;
      }

      if (shouldResolvePreset(preset, existingPresets, ignorePresets)) {
        logger.trace(`Resolving preset "${preset}"`);
        // carry on, so that every preset which can't be resolved is reported, not only the first
        const { config: presetConfig, visitedPresets } = await tryResolve(
          presetErrors,
          async () => {
            const fetchedPreset = await fetchPreset(
              preset,
              baseConfig,
              inputConfig,
              existingPresets,
              failedPresets,
            );
            return resolvePresets(
              fetchedPreset,
              baseConfig ?? inputConfig,
              ignorePresets,
              existingPresets.concat([preset]),
              mergeInternalPresets,
              failedPresets,
            );
          },
        );
        config = mergeChildConfig(config, presetConfig);
        allVisitedPresets.merged.add(preset);

        // then also make sure we've noted any nested presets we've merged
        for (const mergedPreset of visitedPresets.merged) {
          allVisitedPresets.merged.add(mergedPreset);
        }
        // ... or not merged
        for (const unmergedPreset of visitedPresets.unmerged) {
          allVisitedPresets.unmerged.add(unmergedPreset);
        }
      }
    }
  }
  logger.trace({ config }, `Post-preset resolve config`);
  // Now assign "regular" config on top
  config = mergeChildConfig(config, inputConfig);
  delete config.extends;
  delete config.ignorePresets;
  // Any description of this config replaces the ones collated from its presets.
  // Check the length, because array options default to an empty array.
  if (config.overrideDescription?.length) {
    config.description = config.overrideDescription;
  }
  delete config.overrideDescription;
  logger.trace({ config }, `Post-merge resolve config`);
  for (const [key, val] of Object.entries(config) as [
    keyof AllConfig,
    unknown,
  ][]) {
    const ignoredKeys = ['content', 'onboardingConfig'];
    if (isArray(val)) {
      // Resolve nested objects inside arrays
      config[key] = [] as never; // type can't be narrowed
      for (const element of val) {
        if (isObject(element)) {
          const { config: presetConfig, visitedPresets: visited } =
            await tryResolve(presetErrors, () =>
              resolvePresets(
                element,
                baseConfig,
                ignorePresets,
                existingPresets,
                mergeInternalPresets,
                failedPresets,
              ),
            );
          (config[key] as RenovateConfig[]).push(presetConfig);

          // then also make sure we've noted any nested presets we've merged
          for (const mergedPreset of visited.merged) {
            allVisitedPresets.merged.add(mergedPreset);
          }
          // ... or not merged
          for (const unmergedPreset of visited.unmerged) {
            allVisitedPresets.unmerged.add(unmergedPreset);
          }
        } else {
          (config[key] as unknown[]).push(element);
        }
      }
    } else if (isObject(val) && !ignoredKeys.includes(key)) {
      // Resolve nested objects
      logger.trace(`Resolving object "${key}"`);
      const { config: presetConfig, visitedPresets: visited } =
        await tryResolve(presetErrors, () =>
          resolvePresets(
            val,
            baseConfig,
            ignorePresets,
            existingPresets,
            mergeInternalPresets,
            failedPresets,
          ),
        );
      config[key] = presetConfig as never; // type can't be narrowed

      // then also make sure we've noted any nested presets we've merged
      for (const mergedPreset of visited.merged) {
        allVisitedPresets.merged.add(mergedPreset);
      }
      // ... or not merged
      for (const unmergedPreset of visited.unmerged) {
        allVisitedPresets.unmerged.add(unmergedPreset);
      }
    }
  }
  if (presetErrors.length) {
    throwPresetErrors(presetErrors);
  }
  logger.trace({ config: inputConfig }, 'Input config');
  logger.trace(
    { config, visitedPresets: allVisitedPresets },
    'Resolved config',
  );

  return {
    config,
    visitedPresets: {
      merged: Array.from(allVisitedPresets.merged),
      unmerged: Array.from(allVisitedPresets.unmerged),
    },
  };
}

async function fetchPreset(
  preset: string,
  baseConfig: RenovateConfig | undefined,
  inputConfig: AllConfig,
  existingPresets: string[],
  failedPresets: Map<string, Error>,
): Promise<AllConfig> {
  // a preset which can't be fetched may be included in several places, so is only fetched once while resolving
  const previousFailure = failedPresets.get(preset);
  try {
    if (previousFailure) {
      throw previousFailure;
    }
    return await getPreset(preset, baseConfig ?? inputConfig);
  } catch (err) {
    // only log when the preset was fetched, rather than for each place it's included
    if (!previousFailure) {
      logger.debug({ preset, err }, 'Preset fetch error');
    }
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
      throw err;
    }
    // preset sources report a preset they couldn't fetch as not found, even when they were rate limited
    if (err.cause?.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
      throw err.cause;
    }
    failedPresets.set(preset, err);
    const error = new PresetError(preset);
    // further detail, shown below the error type when the error is reported to users
    const details: string[] = [];
    // most preset sources report a blocked host as the preset not being found
    if (err.message === HOST_BLOCKED || err.cause?.message === HOST_BLOCKED) {
      if (!previousFailure) {
        logger.warn(
          {
            preset,
            documentationUrl: `${GlobalConfig.get('productLinks').documentation}self-hosted-configuration/#hostrulesallowinternal`,
          },
          'Preset host is blocked by this Renovate instance',
        );
      }
      error.validationError =
        'Preset host is blocked by this Renovate instance';
      // a preset's response becomes configuration, so a plain hostname grant is not enough - say what the administrator actually has to configure
      details.push(
        'If this is intended, ask your Renovate administrator to permit it with a `hostRules` entry setting `allowInternal=true`, scoped either by `hostType` (for example `preset` or `npm`) or by a URL-prefix `matchHost`.',
      );
    } else if (err.message === PRESET_DEP_NOT_FOUND) {
      error.validationError = `Cannot find preset's package`;
      // only the status code is reported, as the underlying error may include details about the host that shouldn't be shared
      // read from the HTTP error directly, rather than importing the HTTP client to check its type
      const statusCode: number | undefined = err.cause?.response?.statusCode;
      if (statusCode === 401 || statusCode === 403) {
        details.push(
          `Renovate is not authorized to fetch this preset (HTTP ${statusCode}). Check that Renovate has access to it.`,
        );
      } else if (
        // the GitHub HTTP client replaces some 401s and 403s with its own errors, which aren't `HttpError`s
        err.cause?.message === PLATFORM_BAD_CREDENTIALS ||
        err.cause?.message === PLATFORM_INTEGRATION_UNAUTHORIZED
      ) {
        details.push(
          `Renovate is not authorized to fetch this preset. Check that Renovate has access to it.`,
        );
      } else if (statusCode === 404) {
        details.push(
          `The preset could not be found (HTTP 404). Check that the preset exists, and that Renovate has access to it, as some hosts report a preset as not found when Renovate cannot access it.`,
        );
      } else if (statusCode) {
        details.push(`Fetching the preset failed (HTTP ${statusCode}).`);
      }
    } else if (err.message === PRESET_RENOVATE_CONFIG_NOT_FOUND) {
      error.validationError = `Preset package is missing a renovate-config entry`;
    } else if (err.message === PRESET_NOT_FOUND) {
      error.validationError = `Preset name not found within published preset config`;
    } else if (err.message === PRESET_INVALID) {
      error.validationError = `Preset is invalid`;
    } else if (err.message === PRESET_PROHIBITED_SUBPRESET) {
      error.validationError = `Sub-presets cannot be combined with a custom path`;
    } else if (err.message === PRESET_INVALID_JSON) {
      error.validationError = `Preset is invalid JSON`;
      // unlike fetch errors, the parser's message is shared, as it only refers to the preset's own content
      if (err.cause instanceof Error) {
        details.push(
          `Parsing failed with: \`${err.cause.message.replaceAll('`', "'")}\``,
        );
      }
    } else if (err.message === PRESET_RELATIVE_NO_PARENT) {
      error.validationError = `Relative preset reference cannot be resolved`;
      details.push(
        'Relative presets can only be used within presets from a supported source, must stay inside their repository, and cannot be templated or used outside of a preset (for example in the repository config, inherited config, or globalExtends).',
      );
    } else {
      error.validationError = `Preset caused unexpected error`;
    }
    const parentPreset = existingPresets.at(-1);
    error.inclusions.push(
      parentPreset
        ? {
            chain: [...existingPresets, preset]
              .map((p) => `\`${sanitizeUrls(p)}\``)
              .join(' → '),
            parent: `\`${sanitizeUrls(parentPreset)}\``,
          }
        : undefined,
    );
    error.details = details;
    if (!previousFailure) {
      logger.info(
        {
          preset: error.validationSource,
          validationError: error.validationError,
          details,
        },
        'Throwing preset error',
      );
    }
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
