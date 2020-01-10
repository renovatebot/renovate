import { emojify } from '../../../../util/emoji';
import { logger } from '../../../../logger';
import { configFileNames } from '../../../../config/app-strings';
import { RenovateConfig } from '../../../../config';
import { PackageFile } from '../../../../manager/common';

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
  const desc = `Run Renovate on following schedule: ${config.schedule}`;
  return [desc];
}

function getDescriptionArray(config: RenovateConfig): string[] {
  logger.debug('getDescriptionArray()');
  logger.trace({ config });
  return (config.description || []).concat(getScheduleDesc(config));
}

export function getConfigDesc(
  config: RenovateConfig,
  packageFiles?: Record<string, PackageFile[]>
): string {
  logger.debug('getConfigDesc()');
  logger.trace({ config });
  let descriptionArr = getDescriptionArray(config);
  if (!descriptionArr.length) {
    logger.debug('No config description found');
    return '';
  }
  logger.debug({ length: descriptionArr.length }, 'Found description array');
  const enabledManagers = packageFiles ? Object.keys(packageFiles) : [];
  if (
    !(
      enabledManagers.includes('dockerfile') ||
      enabledManagers.includes('circleci') ||
      enabledManagers.includes('docker-compose')
    )
  ) {
    descriptionArr = descriptionArr.filter(val => !val.includes('Docker-only'));
  }
  let desc = `\n### Configuration Summary\n\nBased on the default config's presets, Renovate will:\n\n`;
  desc += `  - Start dependency updates only once this onboarding PR is merged\n`;
  descriptionArr.forEach(d => {
    desc += `  - ${d}\n`;
  });
  desc += '\n';
  desc += emojify(
    `:abcd: Would you like to change the way Renovate is upgrading your dependencies?`
  );
  desc += ` Simply edit the \`${defaultConfigFile}\` in this branch with your custom config and the list of Pull Requests in the "What to Expect" section below will be updated the next time Renovate runs.`;
  desc += '\n\n---\n';
  return desc;
}
