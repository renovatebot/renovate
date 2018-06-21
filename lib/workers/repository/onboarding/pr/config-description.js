function getScheduleDesc(config) {
  logger.debug('getScheduleDesc()');
  logger.trace({ config });
  if (!(config.schedule && config.schedule.length)) {
    logger.debug('No schedule');
    return [];
  }
  const desc = `Run Renovate on following schedule: ${config.schedule}`;
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
  const managers = packageFiles ? Object.keys(packageFiles) : [];
  if (!(managers.includes('docker') || managers.includes('docker-compose'))) {
    descriptionArr = descriptionArr.filter(val => !val.includes('Docker-only'));
  }
  let desc = `\n## Configuration Summary\n\nBased on the currently configured presets, Renovate will:\n\n`;
  desc +=
    '  - Start dependency updates only once this Configure Renovate PR is merged\n';
  descriptionArr.forEach(d => {
    desc += `  - ${d}\n`;
  });
  desc += '\n';
  desc += `Would you like to change the way Renovate is upgrading your dependencies?`;
  desc += ` Simply edit the \`renovate.json\` in this branch and this Pull Request description will be updated the next time Renovate runs. Try to use Config Presets (the \`extends\` array) when possible rather than raw config, as then this PR will be able to more accurately describe your settings.`;
  desc += '\n\n---\n';
  return desc;
}

module.exports = {
  getScheduleDesc,
  getConfigDesc,
};
