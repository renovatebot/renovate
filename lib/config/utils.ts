import { logger } from '../logger';
import { clone } from '../util/clone';
import * as options from './options';
import type { RenovateConfig } from './types';

export function mergeChildConfig<
  T extends RenovateConfig,
  TChild extends RenovateConfig
>(parent: T, child: TChild): T & TChild {
  logger.trace({ parent, child }, `mergeChildConfig`);
  if (!child) {
    return parent as never;
  }
  const parentConfig = clone(parent);
  const childConfig = clone(child);
  const config: Record<string, any> = { ...parentConfig, ...childConfig };
  for (const option of options.getOptions()) {
    if (
      option.mergeable &&
      childConfig[option.name] &&
      parentConfig[option.name]
    ) {
      logger.trace(`mergeable option: ${option.name}`);
      if (option.name === 'constraints') {
        config[option.name] = {
          ...(parentConfig[option.name] as RenovateConfig),
          ...(childConfig[option.name] as RenovateConfig),
        };
      } else if (option.type === 'array') {
        config[option.name] = (parentConfig[option.name] as unknown[]).concat(
          config[option.name]
        );
      } else {
        config[option.name] = mergeChildConfig(
          parentConfig[option.name] as RenovateConfig,
          childConfig[option.name] as RenovateConfig
        );
      }
      logger.trace(
        { result: config[option.name] },
        `Merged config.${option.name}`
      );
    }
  }
  return { ...config, ...config.force };
}
