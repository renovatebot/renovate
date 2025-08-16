import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../modules/manager/types';
import { emojify } from '../../../../util/emoji';
import { getDefaultConfigFileName } from '../common';

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
  const desc = is.array(config.description, is.string)
    ? config.description
    : [];
  return desc.concat(getScheduleDesc(config));
}

export function getConfigDesc(
  config: RenovateConfig,
  packageFiles?: Record<string, PackageFile[]>,
): string {
  // TODO: type (#22198)
  const configFile = getDefaultConfigFileName(config);
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
    `:abcd: Do you want to change how Renovate upgrades your dependencies?`,
  );
  desc += ` Add your custom config to \`${configFile}\` in this branch${
    config.onboardingRebaseCheckbox
      ? ' and select the Retry/Rebase checkbox below'
      : ''
  }. Renovate will update the Pull Request description the next time it runs.`;
  desc += '\n\n---\n';
  return desc;
}
