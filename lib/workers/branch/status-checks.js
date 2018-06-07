module.exports = {
  setUnpublishable,
};

async function setUnpublishable(config) {
  if (!config.unpublishSafe) {
    return;
  }
  const canBeUnpublished = config.upgrades.some(
    upgrade => upgrade.canBeUnpublished
  );
  const context = 'renovate/unpublish-safe';
  const existingState = await platform.getBranchStatusCheck(
    config.branchName,
    context
  );
  // Set canBeUnpublished status check
  const state = canBeUnpublished ? 'pending' : 'success';
  const description = canBeUnpublished
    ? 'Packages < 24 hours old can be unpublished'
    : 'Packages cannot be unpublished';
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
