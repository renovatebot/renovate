import { isNullOrUndefined } from '@sindresorhus/is';
import { getDefault, isRepoDefaultedOption } from '../../../config/defaults.ts';
import { getOptions } from '../../../config/options/index.ts';
import type {
  RenovateConfig,
  RenovateConfigFile,
} from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';

/**
 * Gives each option with a default its default value, where the config leaves it out or sets it to `null`, which the config validation doesn't reject.
 */
export function applyRepoConfigDefaults(
  config: RenovateConfigFile,
): RenovateConfig {
  const defaults: Record<string, unknown> = {};
  for (const option of getOptions().filter(isRepoDefaultedOption)) {
    const value = config[option.name as keyof RenovateConfigFile];
    if (isNullOrUndefined(value)) {
      defaults[option.name] = getDefault(option);
    }
  }

  const names = Object.keys(defaults);
  if (names.length) {
    logger.debug(`Using the default value of ${names.join(', ')}`);
  }

  return Object.assign(config, defaults) as RenovateConfig;
}
