const githubPlatform = require('../../../platform/github');
const gitlabPlatform = require('../../../platform/gitlab');
const { detectSemanticCommits } = require('./semantic');

async function assignPlatform(config) {
  const platforms = {
    github: githubPlatform,
    gitlab: gitlabPlatform,
  };
  return { ...config, api: platforms[config.platform] };
}

async function getPlatformConfig(config) {
  return {
    ...config,
    platformConfig: await config.api.initRepo(
      config.repository,
      config.token,
      config.endpoint,
      config.logger
    ),
  };
}

async function initApis(input, token) {
  let config = { ...input, token };
  config = await assignPlatform(config);
  config = await getPlatformConfig(config);
  config = await detectSemanticCommits(config);
  return config;
}

module.exports = {
  initApis,
};
