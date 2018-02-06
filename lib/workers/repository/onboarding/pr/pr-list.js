function getPrList(config) {
  const { branches } = config;
  logger.debug('getPrList()');
  logger.trace({ config });
  let prDesc = `\n### What to Expect\n\n`;
  if (!branches.length) {
    return `${prDesc}It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.\n`;
  }
  prDesc += `With your current configuration, Renovate will create ${
    branches.length
  } Pull Request`;
  prDesc += branches.length > 1 ? `s:\n\n` : `:\n\n`;

  for (const [index, branch] of branches.entries()) {
    const prTitleRe = /@([a-z]+\/[a-z]+)/;
    prDesc += `${index + 1}. **${branch.prTitle.replace(
      prTitleRe,
      '@&#8203;$1'
    )}**\n\n`;
    if (branch.schedule && branch.schedule.length) {
      prDesc += `  - Schedule: ${JSON.stringify(branch.schedule)}\n`;
    }
    prDesc += `  - Branch name: \`${branch.branchName}\`\n`;
    prDesc += config.baseBranch
      ? `  - Merge into: \`${branch.baseBranch}\`\n`
      : '';
    for (const upgrade of branch.upgrades) {
      if (upgrade.type === 'lockFileMaintenance') {
        prDesc += '  - Regenerates lock file to use latest dependency versions';
      } else {
        if (upgrade.isPin) {
          prDesc += '  - Pins ';
        } else {
          prDesc += '  - Upgrades ';
        }
        if (upgrade.repositoryUrl) {
          prDesc += `[${upgrade.depName}](${upgrade.repositoryUrl})`;
        } else {
          prDesc += upgrade.depName.replace(prTitleRe, '@&#8203;$1');
        }
        prDesc += ` in \`${upgrade.depType}\` `;
        if (!upgrade.isPin) {
          prDesc += `from \`${upgrade.currentVersion}\` `;
        }
        prDesc += `to \`${upgrade.newVersion || upgrade.newDigest}\``;
        prDesc += '\n';
      }
    }
    prDesc += '\n\n';
  }
  return prDesc;
}

module.exports = {
  getPrList,
};
