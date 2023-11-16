import is from '@sindresorhus/is';
import { configFileNames } from '../../../../config/app-strings';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../modules/manager/types';
import { emojify } from '../../../../util/emoji';

const defaultConfigFile = configFileNames[0];

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
  const desc = is.nonEmptyArray(config.description) ? config.description : [];
  return desc.concat(getScheduleDesc(config));
}

export function getConfigDesc(
  config: RenovateConfig,
  packageFiles?: Record<string, PackageFile[]>,
): string {
  // TODO: type (#22198)
  const configFile = configFileNames.includes(config.onboardingConfigFileName!)
    ? config.onboardingConfigFileName!
    : defaultConfigFile;
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
  desc += '\n';
  desc += emojify(
    `:abcd: Would you like to change the way Renovate is upgrading your dependencies?`,
  );
  desc += ` Simply edit the \`${configFile}\` in this branch with your custom config and the list of Pull Requests in the "What to Expect" section below will be updated the next time Renovate runs.`;
  desc += '\n\n---\n';
  return desc;
}
