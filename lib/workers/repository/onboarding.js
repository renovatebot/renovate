const onboardPrTitle = 'Configure Renovate';

module.exports = {
  isRepoPrivate,
  createBranch,
  ensurePr,
  getOnboardingStatus,
};

async function isRepoPrivate(config) {
  let repoIsPrivate = true;
  for (const packageFile of config.packageFiles) {
    const fileName =
      typeof packageFile === 'string' ? packageFile : packageFile.packageFile;
    if (fileName.endsWith('package.json')) {
      const packageContent = await config.api.getFileJson(fileName);
      repoIsPrivate = repoIsPrivate && packageContent && packageContent.private;
    }
  }
  return repoIsPrivate === true;
}

async function createBranch(config) {
  const { logger } = config;
  const onboardBranchName = `${config.branchPrefix}configure`;
  const repoIsPrivate = await module.exports.isRepoPrivate(config);
  let onboardingConfigString;
  if (repoIsPrivate) {
    logger.debug('Repo is private - setting to app type');
    onboardingConfigString = `{\n  "extends": ["config:js-app"]\n}\n`;
  } else {
    logger.debug('Repo is not private - setting to library');
    onboardingConfigString = `{\n  "extends": ["config:js-lib"]\n}\n`;
  }
  const existingContent = await config.api.getFileContent(
    'renovate.json',
    onboardBranchName
  );
  if (existingContent === onboardingConfigString) {
    logger.debug('Onboarding branch is already up-to-date');
    return;
  }
  if (existingContent) {
    logger.debug(
      { existingContent, onboardingConfigString },
      'Updating onboarding branch'
    );
  } else {
    logger.debug('Creating onboarding branch');
  }

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
  const { logger, errors, warnings } = config;
  const description = config.description || [];
  if (config.assignees && config.assignees.length) {
    const assignees = config.assignees.map(
      assignee => (assignee[0] === '@' ? assignee : `@${assignee}`)
    );
    description.push(`Assign PRs to ${assignees.join(' and ')}`);
  }
  if (config.labels && config.labels.length) {
    let desc = 'Apply label';
    if (config.labels.length > 1) {
      desc += 's';
    }
    desc += ` ${config.labels
      .map(label => `<code>${label}</code>`)
      .join(' and ')} to PRs`;
    description.push(desc);
  }
  if (config.schedule && config.schedule.length) {
    description.push(`Run Renovate on following schedule: ${config.schedule}`);
  }
  let prBody = `Welcome to [Renovate](https://renovateapp.com)!

This is an onboarding PR to help you understand and configure Renovate before any regular Pull Requests begin. Once you close this Pull Request, Renovate will begin keeping your dependencies up-to-date via automated Pull Requests.

If you have any questions, try reading our [Getting Started Configuring Renovate](https://renovateapp.com/docs/getting-started/configure-renovate) page first, or feel free to ask the app author @rarkins a question in a comment below.

---

{{BASEBRANCHDESCRIPTION}}{{PRDESCRIPTION}}

Sometimes you may see multiple options for the same dependency (e.g. pinning in one branch and upgrading in another). This is expected and allows you the flexibility to choose which to merge first. Once you merge any PR, others will be updated or removed the next time Renovate runs.

Would you like to change the way Renovate is upgrading your dependencies? Simply edit the \`renovate.json\` in this branch and this Pull Request description will be updated the next time Renovate runs.

Our [Configuration Docs](https://renovateapp.com/docs/) should be helpful if you wish to modify any behaviour.

---

#### Don't want a \`renovate.json\` file?

You are not required to *merge* this Pull Request - Renovate will begin even if this "Configure Renovate" PR is closed *unmerged* and without a \`renovate.json\` file. However, it's recommended that you add configuration to your repository to ensure behaviour matches what you see described here.

Alternatively, you can add the same configuration settings into a "renovate" section of your \`package.json\` file(s) in this branch and delete the \`renovate.json\` from this PR. If you make these configuration changes in this branch then the results will be described in this PR after the next time Renovate runs.

#### Want to start over?

If you'd like Renovate to recreate this "Configure Renovate" PR from scratch - for example if your base branch has had substantial changes - then you need to:

1. (IMPORTANT) Rename this PR to something else, e.g. "Configure Renovate - old"
2. Close the PR and delete the branch

If later on you ever wish to reconfigure Renovate then you can use this same trick of renaming the PR, but you'll also need to delete any \`renovate.json\` file too. You should then get a new "Configure Renovate" PR like this.
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
    let prErrors = `---\n\n### Errors (${errors.length})\n\n`;
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
  if (description.length) {
    let configDesc = `---\n\n## Configuration Summary\n\nBased on the currently configured presets, Renovate will:\n<ul>\n`;
    configDesc +=
      '  <li>Start dependency updates once this Configure Renovate PR is merged or closed</li>\n';
    description.forEach(desc => {
      configDesc += `  <li>${desc}</li>\n`;
    });
    configDesc += '\n</ul>\n\n---';
    prBody = prBody.replace('---', configDesc);
  }

  // Describe base branch only if it's configured
  let baseBranchDesc = '';
  if (
    config.contentBaseBranch &&
    config.contentBaseBranch !== `${config.branchPrefix}configure`
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
    const prTitleRe = /@([a-z]+\/[a-z]+)/;
    prDesc += `| **${branch.prTitle.replace(prTitleRe, '@&#8203;$1')}**<ul>`;
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
        if (upgrade.repositoryUrl) {
          prDesc += `[${upgrade.depName}](${upgrade.repositoryUrl})`;
        } else {
          prDesc += upgrade.depName.replace(prTitleRe, '@&#8203;$1');
        }
        prDesc += ` in \`${upgrade.depType}\` `;
        if (!upgrade.isPin) {
          prDesc += `from \`${upgrade.currentVersion}\` `;
        }
        prDesc += `to \`${upgrade.newVersion}\``;
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
  const onboardBranchName = `${config.branchPrefix}configure`;
  const existingPr = await config.api.getBranchPr(onboardBranchName);
  if (existingPr) {
    // Check if existing PR needs updating
    if (existingPr.title === onboardPrTitle && existingPr.body === prBody) {
      logger.info(`${existingPr.displayNumber} does not need updating`);
      return;
    }
    // PR must need updating
    await config.api.updatePr(existingPr.number, onboardPrTitle, prBody);
    logger.info(`Updated ${existingPr.displayNumber}`);
    return;
  }
  const pr = await config.api.createPr(
    onboardBranchName,
    onboardPrTitle,
    prBody,
    true
  );
  logger.debug(`Created ${pr.displayNumber} for configuration`);
}

async function getOnboardingStatus(inputConfig) {
  const config = { ...inputConfig };
  const { logger } = config;
  logger.debug('Checking if repo is configured');
  // Check if repository is configured
  if (config.onboarding === false) {
    logger.debug('Repo onboarding is disabled');
    return { ...config, repoIsOnboarded: true };
  }
  if (config.renovateJsonPresent || config.hasPackageJsonRenovateConfig) {
    logger.debug('Repo has been configured');
    return { ...config, repoIsOnboarded: true };
  }
  const pr = await config.api.findPr(
    `${config.branchPrefix}configure`,
    'Configure Renovate'
  );
  if (pr) {
    logger.debug(`Found existing onboarding PR#${pr.number}`);
    if (pr.isClosed) {
      logger.debug('Found closed Configure Renovate PR');
      return { ...config, repoIsOnboarded: true };
    }
    // PR exists but hasn't been closed yet
    logger.debug(
      `PR #${pr.displayNumber} needs to be closed to enable renovate to continue`
    );
    const prDetails = await config.api.getPr(pr.number);
    if (!prDetails.canRebase) {
      // Cannot update files if rebasing not possible
      return { ...config, repoIsOnboarded: false };
    }
  }
  // Create or update files, then return
  await module.exports.createBranch(config);
  return { ...config, repoIsOnboarded: false };
}
