const {
  appName,
  configFileNames,
  onboardingPrTitle,
} = require('../../../../config/app-strings');

const defaultConfigFile = configFileNames[0];

function getScheduleDesc(config) {
  logger.debug('getScheduleDesc()');
  logger.trace({ config });
  if (
    !config.schedule ||
    config.schedule === 'at any time' ||
    config.schedule[0] === 'at any time'
  ) {
    logger.debug('No schedule');
    return [];
  }
  const desc = `Run ${appName} on following schedule: ${config.schedule}`;
  return [desc];
}

function getDescriptionArray(config) {
  logger.debug('getDescriptionArray()');
  logger.trace({ config });
  return (config.description || []).concat(getScheduleDesc(config));
}

function getConfigDesc(config, packageFiles) {
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
  let desc = `\n### Configuration Summary\n\nBased on the default config's presets, ${appName} will:\n\n`;
  desc += `  - Start dependency updates only once this ${onboardingPrTitle} PR is merged\n`;
  descriptionArr.forEach(d => {
    desc += `  - ${d}\n`;
  });
  desc += '\n';
  desc += `:abcd: Would you like to change the way ${appName} is upgrading your dependencies?`;
  desc += ` Simply edit the \`${defaultConfigFile}\` in this branch with your custom config and the list of Pull Requests in the "What to Expect" section below will be updated the next time ${appName} runs.`;
  desc += '\n\n---\n';
  return desc;
}

module.exports = {
  getScheduleDesc,
  getConfigDesc,
};
