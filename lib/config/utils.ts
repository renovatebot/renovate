import { isNullOrUndefined } from '@sindresorhus/is';
import { logger } from '../logger/index.ts';
import { clone } from '../util/clone.ts';
import { getHighestVulnerabilitySeverity } from '../util/vulnerability/utils.ts';
import { getDefault, isRepoDefaultedOption } from './defaults.ts';
import * as options from './options/index.ts';
import type { RenovateOptions } from './types.ts';

let repoDefaultedOptions: RenovateOptions[] | undefined;

/**
 * Gives an option with a default its default value where the merge set it to `null` over a value of `parent`, as `applyRepoConfigDefaults()` does for the repository config.
 *
 * A `null` over a missing value is kept, so that a config without its defaults doesn't get them from the merge.
 */
function applyDefaultsForNull(
  config: Record<string, any>,
  parent: Record<string, any>,
): void {
  repoDefaultedOptions ??= options.getOptions().filter(isRepoDefaultedOption);
  for (const option of repoDefaultedOptions) {
    if (
      config[option.name] === null &&
      !isNullOrUndefined(parent[option.name])
    ) {
      config[option.name] = getDefault(option);
    }
  }
}

function mergeConfig(
  parent: Record<string, any>,
  child: Record<string, any>,
): Record<string, any> {
  const parentConfig = clone(parent);
  const childConfig = clone(child);
  const config: Record<string, any> = { ...parentConfig, ...childConfig };

  // Ensure highest severity survives parent / child merge
  const hasSeverity =
    parent.vulnerabilitySeverity !== undefined ||
    child.vulnerabilitySeverity !== undefined;
  if (config.isVulnerabilityAlert && hasSeverity) {
    config.vulnerabilitySeverity = getHighestVulnerabilitySeverity(
      parent,
      child,
    );
  }

  for (const option of options.getOptions()) {
    if (
      option.mergeable &&
      childConfig[option.name] &&
      parentConfig[option.name]
    ) {
      logger.trace(`mergeable option: ${option.name}`);

      if (option.name === 'constraints') {
        config[option.name] = {
          ...parentConfig[option.name],
          ...childConfig[option.name],
        };
      } else if (option.type === 'array') {
        config[option.name] = (parentConfig[option.name] as unknown[]).concat(
          config[option.name],
        );
      } else {
        config[option.name] = mergeConfig(
          parentConfig[option.name],
          childConfig[option.name],
        );
      }
      logger.trace(
        { result: config[option.name] },
        `Merged config.${option.name}`,
      );
    }
  }
  return { ...config, ...config.force };
}

/**
 * Merges `child` into `parent`, where the values of `child` win.
 *
 * Where `child`, or the `force` config, sets an option with a default to `null` over a value of `parent`, the result gets the option's default, so a config with its defaults applied keeps them.
 */
export function mergeChildConfig<
  T extends Record<string, any>,
  TChild extends Record<string, any> | undefined,
>(parent: T, child: TChild): T & TChild {
  logger.trace({ parent, child }, `mergeChildConfig`);
  if (!child) {
    return parent as never;
  }
  const config = mergeConfig(parent, child);
  applyDefaultsForNull(config, parent);
  return config as T & TChild;
}
