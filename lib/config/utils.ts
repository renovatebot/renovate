import { logger } from '../logger';
import { clone } from '../util/clone';
import { RenovateConfig } from './common';
import * as definitions from './definitions';

export function mergeChildConfig<T, TChild>(
  parent: T,
  child: TChild
): T & TChild {
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
      if (option.name === 'constraints') {
        config[option.name] = Object.assign(
          parentConfig[option.name],
          childConfig[option.name]
        );
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
  return Object.assign(config, config.force);
}
