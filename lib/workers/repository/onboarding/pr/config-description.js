function getAssigneesDesc(config) {
  logger.debug('getAssigneesDesc()');
  logger.trace({ config });
  if (!(config.assignees && config.assignees.length)) {
    logger.debug('No assignees configuration');
    return [];
  }
  logger.debug('Found assignees config');
  let desc = `Assign PRs to `;
  desc += config.assignees
    .map(assignee => (assignee[0] === '@' ? assignee : `@${assignee}`))
    .join(' and ');
  return [desc];
}

function getLabelsDesc(config) {
  logger.debug('getLabelsDesc()');
  logger.trace({ config });
  if (!(config.labels && config.labels.length)) {
    logger.debug('No labels configuration');
    return [];
  }
  let desc = 'Apply label';
  if (config.labels.length > 1) {
    desc += 's';
  }
  desc += ` ${config.labels.map(label => `\`${label}\``).join(' and ')} to PRs`;
  return [desc];
}

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
  return (config.description || [])
    .concat(getAssigneesDesc(config))
    .concat(getLabelsDesc(config))
    .concat(getScheduleDesc(config));
}

function getConfigDesc(config) {
  logger.debug('getConfigDesc()');
  logger.trace({ config });
  const descriptionArr = getDescriptionArray(config);
  if (!descriptionArr.length) {
    logger.debug('No config description found');
    return '';
  }
  logger.debug({ length: descriptionArr.length }, 'Found description array');
  let desc = `\n## Configuration Summary\n\nBased on the currently configured presets, Renovate will:\n\n`;
  desc +=
    '  - Start dependency updates once this Configure Renovate PR is merged or closed\n';
  descriptionArr.forEach(d => {
    desc += `  - ${d}\n`;
  });
  desc += '\n';
  desc += `Would you like to change the way Renovate is upgrading your dependencies?`;
  desc += ` Simply edit the \`renovate.json\` in this branch and this Pull Request description will be updated the next time Renovate runs. `;
  desc += '\n\n---\n';
  return desc;
}

module.exports = {
  getAssigneesDesc,
  getLabelsDesc,
  getScheduleDesc,
  getConfigDesc,
};
