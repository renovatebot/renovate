const conventionalCommitsDetector = require('conventional-commits-detector');
const stringify = require('json-stringify-pretty-compact');

const configParser = require('../../config');

const onboardBranchName = 'renovate/configure';
const onboardPrTitle = 'Configure Renovate';

module.exports = {
  determineSemanticCommits,
  isRepoPrivate,
  createBranch,
  ensurePr,
  getOnboardingStatus,
};

async function determineSemanticCommits(config) {
  const commitMessages = await config.api.getCommitMessages();
  config.logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  if (type === 'unknown') {
    config.logger.debug('No semantic commit type found');
    return false;
  }
  config.logger.debug(
    `Found semantic commit type ${type} - enabling semantic commits`
  );
  return true;
}

async function isRepoPrivate(config) {
  let repoIsPrivate = true;
  for (const packageFile of config.packageFiles) {
    const fileName =
      typeof packageFile === 'string' ? packageFile : packageFile.packageFile;
    const packageContent = await config.api.getFileJson(fileName);
    repoIsPrivate = repoIsPrivate && packageContent && packageContent.private;
  }
  return repoIsPrivate === true;
}

async function createBranch(config) {
  const onboardingConfig = configParser.getOnboardingConfig(config);
  onboardingConfig.semanticCommits = await module.exports.determineSemanticCommits(
    config
  );
  const repoIsPrivate = await module.exports.isRepoPrivate(config);
  if (repoIsPrivate) {
    config.logger.debug('Repo is private - pinning dependencies versions');
  } else {
    config.logger.debug('Repo is not private - unpinning versions');
    onboardingConfig.depTypes[0].pinVersions = false;
  }
  const onboardingConfigString = `${stringify(onboardingConfig)}\n`;
  await config.api.commitFilesToBranch(
    onboardBranchName,
    [
      {
        name: 'renovate.json',
        contents: onboardingConfigString,
      },
    ],
    'Add renovate.json'
  );
}

async function ensurePr(config, branchUpgrades) {
  const warnings = config.warnings;
  const errors = config.errors;
  let prBody = `Welcome to [Renovate](https://keylocation.sg/our-tech/renovate)!

This is an onboarding PR to help you understand and configure Renovate before any changes are made to any \`package.json\` files. Once you close this Pull Request, Renovate will begin keeping your dependencies up-to-date via automated Pull Requests.

---

{{BASEBRANCHDESCRIPTION}}{{PRDESCRIPTION}}

Sometimes you may see multiple options for the same dependency (e.g. pinning in one branch and upgrading in another). This is expected and allows you the flexibility to choose which to merge first. Once you merge any PR, others will be updated or removed the next time Renovate runs.

Would you like to change the way Renovate is upgrading your dependencies? Simply edit the \`renovate.json\` in this branch and this Pull Request description will be updated the next time Renovate runs.

The [Configuration](https://github.com/singapore/renovate/blob/master/docs/configuration.md) and [Configuration FAQ](https://github.com/singapore/renovate/blob/master/docs/faq.md) documents should be helpful if you wish to modify any behaviour.

---

#### Don't want a \`renovate.json\` file?

You are not required to *merge* this Pull Request - Renovate will begin even if this "Configure Renovate" PR is closed *unmerged* and without a \`renovate.json\` file. However, it's recommended that you add configuration to your repository to ensure behaviour matches what you see described here.

Alternatively, you can add the same configuration settings into a "renovate" section of your \`package.json\` file(s) in this branch and delete the \`renovate.json\` from this PR. If you make these configuration changes in this branch then the results will be described in this PR after the next time Renovate runs.
`;
  if (warnings.length) {
    let prWarnings = `---\n\n### Warnings (${warnings.length})\n\n`;
    prWarnings += `Please correct - or verify that you can safely ignore - these warnings before you merge this PR.
`;
    warnings.forEach(warning => {
      prWarnings += `-   \`${warning.depName}\`: ${warning.message}\n`;
    });
    prWarnings += '\n---';
    prBody = prBody.replace('---', prWarnings);
  }
  if (errors.length) {
    let prErrors = `---\n\n## Errors (${errors.length})\n\n`;
    prErrors += `Renovate has raised errors when processing this repository that you should fix before merging or closing this PR.

Please make any fixes in _this branch_.
`;
    errors.forEach(error => {
      prErrors += `-   \`${error.depName}\`: ${error.message}\n`;
    });
    prErrors +=
      '\nFeel free to raise create a [GitHub Issue](https:/github.com/singapore/renovate/issues) to ask any questions.';
    prErrors += '\n\n---';
    prBody = prBody.replace('---', prErrors);
  }

  // Describe base branch only if it's configured
  let baseBranchDesc = '';
  if (
    config.contentBaseBranch &&
    config.contentBaseBranch !== 'renovate/configure'
  ) {
    baseBranchDesc = `You have configured renovate to use branch \`${config.contentBaseBranch}\` as base branch.\n\n`;
  }
  prBody = prBody.replace('{{BASEBRANCHDESCRIPTION}}', baseBranchDesc);

  let prDesc = `
With your current configuration, renovate will initially create the following Pull Requests:

| Pull Requests (${branchUpgrades.length}) |
| ------ |
`;
  branchUpgrades.forEach(branch => {
    prDesc += `| **${branch.prTitle}**<ul>`;
    if (branch.schedule && branch.schedule.length) {
      prDesc += `<li>Schedule: ${JSON.stringify(branch.schedule)}</li>`;
    }
    prDesc += `<li>Branch name: \`${branch.branchName}\`</li>`;
    branch.upgrades.forEach(upgrade => {
      if (upgrade.type === 'lockFileMaintenance') {
        prDesc +=
          '<li>Regenerates lock file to use latest dependency versions</li>';
      } else {
        if (upgrade.isPin) {
          prDesc += '<li>Pins ';
        } else {
          prDesc += '<li>Upgrades ';
        }
        prDesc += `[${upgrade.depName}](${upgrade.repositoryUrl}) in \`${upgrade.depType}\` from \`${upgrade.currentVersion}\` to \`${upgrade.newVersion}\``;
        prDesc += '</li>';
      }
    });
    prDesc += '</ul> |\n';
  });
  if (branchUpgrades.length === 0) {
    // Overwrite empty content
    prDesc =
      'It looks like your repository dependencies are already up-to-date and no initial Pull Requests will be necessary.';
  }
  prBody = prBody.replace('{{PRDESCRIPTION}}', prDesc);
  // Check if existing PR exists
  const existingPr = await config.api.getBranchPr(onboardBranchName);
  if (existingPr) {
    // Check if existing PR needs updating
    if (existingPr.title === onboardPrTitle && existingPr.body === prBody) {
      config.logger.info(`${existingPr.displayNumber} does not need updating`);
      return;
    }
    // PR must need updating
    await config.api.updatePr(existingPr.number, onboardPrTitle, prBody);
    config.logger.info(`Updated ${existingPr.displayNumber}`);
    return;
  }
  const pr = await config.api.createPr(
    onboardBranchName,
    onboardPrTitle,
    prBody
  );
  config.logger.debug(`Created ${pr.displayNumber} for configuration`);
}

async function getOnboardingStatus(config) {
  config.logger.debug('Checking if repo is configured');
  // Check if repository is configured
  if (config.onboarding === false) {
    config.logger.debug('Repo onboarding is disabled');
    return true;
  }
  if (config.renovateJsonPresent) {
    config.logger.debug('Repo onboarded');
    return true;
  }
  const pr = await config.api.findPr(
    'renovate/configure',
    'Configure Renovate'
  );
  if (pr) {
    config.logger.debug(`Found existing onboarding PR#${pr.number}`);
    if (pr.isClosed) {
      config.logger.debug('Found closed Configure Renovate PR');
      return true;
    }
    // PR exists but hasn't been closed yet
    config.logger.debug(
      `PR #${pr.displayNumber} needs to be closed to enable renovate to continue`
    );
    const prDetails = await config.api.getPr(pr.number);
    if (!prDetails.canRebase) {
      // Cannot update files if rebasing not possible
      return false;
    }
  }
  // Create or update files, then return
  await module.exports.createBranch(config);
  return false;
}
