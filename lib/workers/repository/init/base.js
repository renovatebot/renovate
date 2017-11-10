async function checkBaseBranch(config) {
  let error = [];
  if (config.baseBranch) {
    // Renovate should read content and target PRs here
    if (await platform.branchExists(config.baseBranch)) {
      await platform.setBaseBranch(config.baseBranch);
    } else {
      // Warn and ignore setting (use default branch)
      const message = `The configured baseBranch "${
        config.baseBranch
      }" is not present. Ignoring`;
      error = [
        {
          depName: 'baseBranch',
          message,
        },
      ];
      logger.warn(message);
    }
  }
  return { ...config, errors: config.errors.concat(error) };
}

module.exports = {
  checkBaseBranch,
};
