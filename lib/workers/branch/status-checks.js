const { logger } = require('../../logger');
const { appSlug, urls } = require('../../config/app-strings');

module.exports = {
  setUnpublishable,
};

async function setStatusCheck(branchName, context, description, state) {
  const existingState = await platform.getBranchStatusCheck(
    branchName,
    context
  );
  // Check if state needs setting
  if (existingState === state) {
    logger.debug(`Status check ${context} is already up-to-date`);
  } else {
    logger.debug(`Updating ${context} status check state to ${state}`);
    await platform.setBranchStatus(
      branchName,
      context,
      description,
      state,
      urls.documentation
    );
  }
}

function setUnpublishable(config) {
  if (!config.unpublishSafe) {
    return;
  }
  const context = `${appSlug}/unpublish-safe`;
  // Set canBeUnpublished status check
  const state = config.canBeUnpublished ? 'pending' : 'success';
  const description = config.canBeUnpublished
    ? 'Packages < 24 hours old can be unpublished'
    : 'Packages cannot be unpublished';
  return setStatusCheck(config.branchName, context, description, state);
}
