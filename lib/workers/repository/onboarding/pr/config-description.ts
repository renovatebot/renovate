import { isArray, isString } from '@sindresorhus/is';
import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import type { PackageFile } from '../../../../modules/manager/types.ts';

export function getScheduleDesc(config: RenovateConfig): string[] {
  logger.debug('getScheduleDesc()');
  logger.trace({ config });
  if (
    !config.schedule ||
    (config.schedule as never) === 'at any time' ||
    config.schedule[0] === 'at any time'
  ) {
    logger.debug('No schedule');
    return [];
  }
  const desc = `Run Renovate on following schedule: ${String(config.schedule)}`;
  return [desc];
}

function getDescriptionArray(config: RenovateConfig): string[] {
  logger.debug('getDescriptionArray()');
  logger.trace({ config });
  const desc = isArray(config.description, isString) ? config.description : [];
  return desc.concat(getScheduleDesc(config));
}

export function getConfigDesc(
  config: RenovateConfig,
  // TODO: remove unused parameter
  _packageFiles?: Record<string, PackageFile[]>,
): string {
  // TODO: type (#22198)
  logger.debug('getConfigDesc()');
  logger.trace({ config });
  const descriptionArr = getDescriptionArray(config);
  if (!descriptionArr.length) {
    logger.debug('No config description found');
    return '';
  }
  logger.debug(`Found description array with length:${descriptionArr.length}`);
  let desc = `\n### Configuration Summary\n\nBased on the default config's presets, Renovate will:\n\n`;
  desc += `  - Start dependency updates only once this onboarding PR is merged\n`;
  descriptionArr.forEach((d) => {
    desc += `  - ${d}\n`;
  });
  desc += '\n---\n';
  return desc;
}
