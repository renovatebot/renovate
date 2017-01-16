const logger = require('winston');

const config = {
  logLevel: 'info',
  depTypes: ['dependencies', 'devDependencies', 'optionalDependencies'],
  ignoreDeps: [],
  labels: [],
  templates: {
    branchName: params => `renovate/${params.depName}-${params.newVersionMajor}.x`,
    commitMessage: params => `Update dependency ${params.depName} to version ${params.newVersion}`,
    commitMessagePin: params => `Pin dependency ${params.depName} to version ${params.newVersion}`,
    prBody: params => `This Pull Request updates dependency ${params.depName}` +
      ` from version ${params.currentVersion} to ${params.newVersion}

${params.changelog}`,
    prTitleMajor: params => `Update dependency ${params.depName} to version ${params.newVersionMajor}.x`,
    prTitleMinor: params => `Update dependency ${params.depName} to version ${params.newVersion}`,
    prTitlePin: params => `Pin dependency ${params.depName} to version ${params.newVersion}`,
  },
  recreateClosed: false,
  recreateUnmergeable: true,
};

logger.debug(`Default config = ${JSON.stringify(config)}`);

module.exports = config;
