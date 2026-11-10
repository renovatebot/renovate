import { isNullOrUndefined } from '@sindresorhus/is';
import { getDefault, isRepoDefaultedOption } from '../../../config/defaults.ts';
import { getOptions } from '../../../config/options/index.ts';
import type {
  AllConfig,
  GlobalWorkerConfig,
  GlobalWorkerNullDefaultedConfigKey,
} from '../../../config/types.ts';

const nullDefaultedOptions: Record<GlobalWorkerNullDefaultedConfigKey, true> = {
  deleteAdditionalConfigFile: true,
  deleteConfigFile: true,
  mergeConfidenceDatasources: true,
  mergeConfidenceEndpoint: true,
};

/**
 * Gives each option of {@link GlobalWorkerConfig} which the config leaves out or sets to `null` its default value.
 */
export function applyGlobalConfigDefaults(
  config: AllConfig,
): GlobalWorkerConfig {
  const values = config as Record<string, unknown>;
  const options = getOptions().filter(
    (option) =>
      isRepoDefaultedOption(option) ||
      Object.hasOwn(nullDefaultedOptions, option.name),
  );
  for (const option of options) {
    if (isNullOrUndefined(values[option.name])) {
      values[option.name] = getDefault(option);
    }
  }
  // every option of `GlobalWorkerConfig` has been given a value above
  return config as GlobalWorkerConfig;
}
