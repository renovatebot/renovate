import { RenovateConfig } from './common';
import { logger } from '../logger';
import { clone } from '../util/clone';
import * as definitions from './definitions';

export function mergeChildConfig<
  T extends RenovateConfig = RenovateConfig,
  TChild extends RenovateConfig = RenovateConfig
>(parent: T, child: TChild): T & TChild {
  logger.trace({ parent, child }, `mergeChildConfig`);
  if (!child) {
    return parent as never;
  }
  const parentConfig = clone(parent);
  const childConfig = clone(child);
  const config: Record<string, any> = { ...parentConfig, ...childConfig };
  for (const option of definitions.getOptions()) {
    if (
      option.mergeable &&
      childConfig[option.name] &&
      parentConfig[option.name]
    ) {
      logger.trace(`mergeable option: ${option.name}`);
      if (option.type === 'array') {
        config[option.name] = parentConfig[option.name].concat(
          config[option.name]
        );
      } else {
        config[option.name] = mergeChildConfig(
          parentConfig[option.name],
          childConfig[option.name]
        );
      }
      logger.trace(
        { result: config[option.name] },
        `Merged config.${option.name}`
      );
    }
  }
  return Object.assign(config, config.force);
}
