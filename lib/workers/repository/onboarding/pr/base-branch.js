const { appName } = require('../../../../config/app-strings');

function getBaseBranchDesc(config) {
  // Describe base branch only if it's configured
  return config.baseBranch
    ? `You have configured ${appName} to use branch \`${
        config.baseBranch
      }\` as base branch.\n\n`
    : '';
}

module.exports = {
  getBaseBranchDesc,
};
