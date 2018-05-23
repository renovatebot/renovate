const is = require('@sindresorhus/is');

module.exports = {
  setUnpublishable,
};

async function setUnpublishable(config) {
  if (!config.unpublishSafe) {
    return;
  }
  let unpublishable;
  for (const upgrade of config.upgrades) {
    if (!is.undefined(upgrade.unpublishable)) {
      if (!is.undefined(unpublishable)) {
        unpublishable = unpublishable && upgrade.unpublishable;
      } else {
        ({ unpublishable } = upgrade);
      }
    }
  }
  if (is.undefined(unpublishable)) {
    unpublishable = true;
  }
  const context = 'renovate/unpublish-safe';
  const existingState = await platform.getBranchStatusCheck(
    config.branchName,
    context
  );
  if (config.unpublishSafe && !is.undefined(unpublishable)) {
    // Set unpublishable status check
    const state = unpublishable ? 'success' : 'pending';
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
        'https://renovatebot.com/docs/configuration-reference/configuration-options#unpublishsafe'
      );
    }
  }
}
