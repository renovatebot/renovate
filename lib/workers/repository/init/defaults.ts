import { isNullOrUndefined } from '@sindresorhus/is';
import type {
  DefaultedConfigKey,
  WithDefaults,
} from '../../../config/defaults.ts';
import { getDefault, isDefaultedOption } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { getOptions } from '../../../config/options/index.ts';
import type { FilteredConfigKey } from '../../../config/stages.ts';
import { isFilteredOption } from '../../../config/stages.ts';
import type { RenovateConfig, RenovateOptions } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';

/**
 * The options with a default which a repository's config doesn't keep, as `GlobalConfig.set()` moves them out of it, or the repository worker deletes them once it has applied them.
 */
const removedOptions = [
  ...GlobalConfig.OPTIONS,
  'env',
  'extends',
  'hostRules',
  'ignorePresets',
  'overrideDescription',
] as const;

const removedOptionNames = new Set<string>(removedOptions);

/**
 * Whether a repository's config doesn't keep an option, as it's one of the `removedOptions`, or of a stage before `repository`, which `getRepositoryConfig()` filters out.
 */
function isRemovedOption(option: RenovateOptions): boolean {
  return (
    removedOptionNames.has(option.name) ||
    isFilteredOption(option, 'repository')
  );
}

type RepoDefaultedConfigKey = Exclude<
  DefaultedConfigKey,
  (typeof removedOptions)[number] | FilteredConfigKey<'repository'>
>;

/**
 * A repository's config, in which the options with a default have a value.
 */
export type RepoConfig<T extends RenovateConfig = RenovateConfig> =
  WithDefaults<T, RepoDefaultedConfigKey>;

/**
 * Gives each option with a default its default value, where the config leaves it out or sets it to `null`, which the config validation doesn't reject.
 */
export function applyRepoConfigDefaults(config: RenovateConfig): RepoConfig {
  const defaults: Record<string, unknown> = {};
  for (const option of getOptions().filter(isDefaultedOption)) {
    const value = config[option.name as keyof RenovateConfig];
    if (!isRemovedOption(option) && isNullOrUndefined(value)) {
      defaults[option.name] = getDefault(option);
    }
  }

  const names = Object.keys(defaults);
  if (names.length) {
    logger.debug(`Using the default value of ${names.join(', ')}`);
  }

  return Object.assign(config, defaults) as RepoConfig;
}
