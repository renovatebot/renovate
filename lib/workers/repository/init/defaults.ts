import { isNullOrUndefined } from '@sindresorhus/is';
import type { WithDefaults } from '../../../config/defaults.ts';
import { getDefault, isDefaultedOption } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { getOptions } from '../../../config/options/index.ts';
import { isFilteredOption } from '../../../config/stages.ts';
import type {
  RenovateConfigFile,
  RenovateOptions,
  RepoDefaultedConfigKey,
  RepoRemovedConfigKey,
} from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';

/**
 * The {@link RepoRemovedConfigKey} options, other than those of the stages before `repository`.
 */
const removedOptions = [
  ...GlobalConfig.OPTIONS,
  'env',
  'extends',
  'hostRules',
  'ignorePresets',
  'overrideDescription',
] as const satisfies readonly RepoRemovedConfigKey[];

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

/**
 * A repository's config, in which the options with a default have a value.
 */
export type RepoConfig<T extends RenovateConfigFile = RenovateConfigFile> =
  WithDefaults<T, RepoDefaultedConfigKey>;

/**
 * Gives each option with a default its default value, where the config leaves it out or sets it to `null`, which the config validation doesn't reject.
 */
export function applyRepoConfigDefaults(
  config: RenovateConfigFile,
): RepoConfig {
  const defaults: Record<string, unknown> = {};
  for (const option of getOptions().filter(isDefaultedOption)) {
    const value = config[option.name as keyof RenovateConfigFile];
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
