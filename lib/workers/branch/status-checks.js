module.exports = {
  setUnpublishable,
};

async function setUnpublishable(config) {
  if (!config.unpublishSafe) {
    return;
  }
  let canBeUnpublished;
  for (const upgrade of config.upgrades) {
    if (typeof upgrade.canBeUnpublished !== 'undefined') {
      if (typeof canBeUnpublished !== 'undefined') {
        canBeUnpublished = canBeUnpublished && upgrade.canBeUnpublished;
      } else {
        ({ canBeUnpublished } = upgrade);
      }
    }
  }
  if (typeof canBeUnpublished === 'undefined') {
    canBeUnpublished = true;
  }
  const context = 'renovate/unpublish-safe';
  const existingState = await platform.getBranchStatusCheck(
    config.branchName,
    context
  );
  if (config.unpublishSafe && typeof canBeUnpublished !== 'undefined') {
    // Set canBeUnpublished status check
    const state = canBeUnpublished ? 'pending' : 'success';
    const description = canBeUnpublished
      ? 'Packages < 24 hours old can be unpublished'
      : 'Packages are at least 24 hours old';
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
