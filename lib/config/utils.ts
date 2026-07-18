import { logger } from '../logger/index.ts';
import { clone } from '../util/clone.ts';
import { getHighestVulnerabilitySeverity } from '../util/vulnerability/utils.ts';
import * as options from './options/index.ts';
import type { RenovateConfig } from './types.ts';

export function mergeChildConfig<
  T extends object,
  TChild extends object | undefined,
>(parent: T, child: TChild): T & TChild {
  logger.trace({ parent, child }, `mergeChildConfig`);
  if (!child) {
    return parent as never;
  }
  const parentConfig = clone(parent) as Record<string, unknown>;
  const childConfig = clone(child) as Record<string, unknown>;
  const config: Record<string, unknown> = { ...parentConfig, ...childConfig };

  // Ensure highest severity survives parent / child merge
  if (config?.isVulnerabilityAlert) {
    config.vulnerabilitySeverity = getHighestVulnerabilitySeverity(
      parent as { vulnerabilitySeverity?: string },
      child as { vulnerabilitySeverity?: string },
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
          ...(parentConfig[option.name] as object),
          ...(childConfig[option.name] as object),
        };
      } else if (option.type === 'array') {
        config[option.name] = (parentConfig[option.name] as unknown[]).concat(
          config[option.name],
        );
      } else {
        config[option.name] = mergeChildConfig(
          parentConfig[option.name] as RenovateConfig,
          childConfig[option.name] as RenovateConfig,
        );
      }
      logger.trace(
        { result: config[option.name] },
        `Merged config.${option.name}`,
      );
    }
  }
  return { ...config, ...(config.force as object | undefined) } as T & TChild;
}
