const platform = require('../../platform');

module.exports = {
  setUnpublishable,
};

async function setUnpublishable(config) {
  const { logger } = config;
  let unpublishable;
  for (const upgrade of config.upgrades) {
    if (typeof upgrade.unpublishable !== 'undefined') {
      if (typeof unpublishable !== 'undefined') {
        unpublishable = unpublishable && upgrade.unpublishable;
      } else {
        ({ unpublishable } = upgrade);
      }
    }
  }
  if (typeof unpublishable === 'undefined') {
    unpublishable = true;
  }
  const context = 'renovate/unpublish-safe';
  const existingState = await platform.getBranchStatusCheck(
    config.branchName,
    context
  );
  // If status check was enabled and then is disabled, any "pending" status check needs to be set to "success"
  const removeStatusCheck =
    existingState === 'pending' && !config.unpublishSafe;
  if (
    (config.unpublishSafe || removeStatusCheck) &&
    typeof unpublishable !== 'undefined'
  ) {
    // Set unpublishable status check
    const state = unpublishable || removeStatusCheck ? 'success' : 'pending';
    const description = unpublishable
      ? 'Packages are at least 24 hours old'
      : 'Packages < 24 hours old can be unpublished';
    // Check if state needs setting
    if (existingState === state) {
      logger.debug('Status check is already up-to-date');
    } else {
      logger.debug(`Updating status check state to ${state}`);
      await platform.setBranchStatus(
        config.branchName,
        context,
        description,
        state,
        'https://github.com/singapore/renovate/blob/master/docs/status-checks.md#unpublish-safe'
      );
    }
  }
}
