const apis = require('./apis');
const manager = require('../../manager');
const bodyFormat = require('../bodyFormat');

const onboardPrTitle = 'Configure Renovate';

module.exports = {
  createOnboardingBranch,
  ensurePr,
  getOnboardingStatus,
};

async function createOnboardingBranch(inputConfig) {
  let config = { ...inputConfig };
  const { logger } = config;
  logger.debug('Creating onboarding branch');
  config = await manager.detectPackageFiles(config);
  if (config.packageFiles.length === 0) {
    throw new Error('no package files');
  }
  const renovateJson = {
    extends: ['config:base'],
  };
  logger.info({ renovateJson }, 'Creating onboarding branch');
  await config.api.commitFilesToBranch(
    config.onboardingBranch,
    [
      {
        name: 'renovate.json',
        contents: `${JSON.stringify(renovateJson, null, 2)}\n`,
      },
    ],
    'Add renovate.json'
  );
  return config;
}

async function ensurePr(config, branchUpgrades) {
  const { logger, errors, warnings } = config;
  const description = config.description || [];
  description.push(
    `Start dependency updates once this Configure Renovate PR is merged or closed`
  );
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
      .map(label => `\`${label}\``)
      .join(' and ')} to PRs`;
    description.push(desc);
  }
  if (config.schedule && config.schedule.length) {
    description.push(`Run Renovate on following schedule: ${config.schedule}`);
  }
  bodyFormat.init();
  bodyFormat.addParagraph(`Welcome to [Renovate](https://renovateapp.com)!`);
  bodyFormat.addParagraph(
    `This is an onboarding PR to help you understand and configure Renovate before any regular Pull Requests begin. Once you close this Pull Request, Renovate will begin keeping your dependencies up-to-date via automated Pull Requests.`
  );
  bodyFormat.addParagraph(
    `If you have any questions, try reading our [Getting Started Configuring Renovate](https://renovateapp.com/docs/getting-started/configure-renovate) page first, or feel free to ask the app author @rarkins a question in a comment below.`
  );
  bodyFormat.addLine();
  if (warnings.length) {
    bodyFormat.addParagraph(`### Warnings (${warnings.length})`);
    bodyFormat.addParagraph(
      `Please correct - or verify that you can safely ignore - these warnings before you merge this PR.`
    );
    bodyFormat.addList(
      warnings.map(warning => `\`${warning.depName}\`: ${warning.message}`)
    );
    bodyFormat.addLine();
  }
  if (errors.length) {
    bodyFormat.addParagraph(`### Errors (${errors.length})`);
    bodyFormat.addParagraph(
      `Renovate has raised errors when processing this repository that you should fix before merging or closing this PR.`
    );
    bodyFormat.addParagraph(`Please make any fixes in _this branch_.`);
    bodyFormat.addList(
      errors.map(error => `\`${error.depName}\`: ${error.message}`)
    );
    bodyFormat.addParagraph(
      `Feel free to raise create a [GitHub Issue](https:/github.com/singapore/renovate/issues) to ask any questions.';`
    );
    bodyFormat.addLine();
  }
  if (description.length) {
    bodyFormat.addParagraph(`## Configuration Summary`);
    bodyFormat.addParagraph(
      `Based on the currently configured presets, Renovate will:`
    );
    bodyFormat.addList(
      description.map(c => c.replace(`<code>`, `\``).replace(`</code>`, `\``))
    );
    bodyFormat.addLine();
  }
  if (
    config.contentBaseBranch &&
    config.contentBaseBranch !== `${config.branchPrefix}configure`
  ) {
    bodyFormat.addParagraph(
      `You have configured renovate to use branch \`${config.contentBaseBranch}\` as base branch`
    );
  }

  if (branchUpgrades.length === 0) {
    bodyFormat.addParagraph(
      `It looks like your repository dependencies are already up-to-date and no initial Pull Requests will be necessary.`
    );
  } else {
    bodyFormat.addParagraph(
      `With your current configuration, renovate will initially create the following Pull Requests:`
    );
    bodyFormat.addParagraph(`### ${branchUpgrades.length} Pull Requests:`);
    bodyFormat.addList(
      branchUpgrades.map(branch => {
        let str = '';
        const prTitleRe = /@([a-z]+\/[a-z]+)/;
        str += `**${branch.prTitle.replace(prTitleRe, '@&#8203;$1')}**`;

        const subList = [];
        if (branch.schedule && branch.schedule.length) {
          subList.push(`Schedule: ${JSON.stringify(branch.schedule)}`);
        }
        subList.push(`Branch name: \`${branch.branchName}\``);
        branch.upgrades.forEach(upgrade => {
          if (upgrade.type === 'lockFileMaintenance') {
            subList.push(
              `Regenerates lock file to use latest dependency versions`
            );
          } else {
            let prDesc = '';
            if (upgrade.isPin) {
              prDesc += 'Pins ';
            } else {
              prDesc += 'Upgrades ';
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
            subList.push(prDesc);
          }
        });
        str += bodyFormat.addSubList(subList);
        return str;
      })
    );
  }

  bodyFormat.addParagraph(
    `Sometimes you may see multiple options for the same dependency (e.g. pinning in one branch and upgrading in another). This is expected and allows you the flexibility to choose which to merge first. Once you merge any PR, others will be updated or removed the next time Renovate runs.`
  );
  bodyFormat.addParagraph(
    `Would you like to change the way Renovate is upgrading your dependencies? Simply edit the \`renovate.json\` in this branch and this Pull Request description will be updated the next time Renovate runs.`
  );
  bodyFormat.addParagraph(
    `Our [Configuration Docs](https://renovateapp.com/docs/) should be helpful if you wish to modify any behaviour.`
  );
  bodyFormat.addLine();
  bodyFormat.addParagraph(`#### Don't want a \`renovate.json\` file?`);
  bodyFormat.addParagraph(
    `You are not required to *merge* this Pull Request - Renovate will begin even if this "Configure Renovate" PR is closed *unmerged* and without a \`renovate.json\` file. However, it's recommended that you add configuration to your repository to ensure behaviour matches what you see described here.`
  );
  bodyFormat.addParagraph(
    `Alternatively, you can add the same configuration settings into a "renovate" section of your \`package.json\` file(s) in this branch and delete the \`renovate.json\` from this PR. If you make these configuration changes in this branch then the results will be described in this PR after the next time Renovate runs.`
  );
  bodyFormat.addParagraph(`#### Want to start over?`);
  bodyFormat.addParagraph(
    `If you'd like Renovate to recreate this "Configure Renovate" PR from scratch - for example if your base branch has had substantial changes - then you need to:`
  );
  bodyFormat.addList(
    [
      `(IMPORTANT) Rename this PR to something else, e.g. "Configure Renovate - old"`,
      `Close the PR and delete the branch`,
    ],
    true
  );
  bodyFormat.addParagraph(
    `If later on you ever wish to reconfigure Renovate then you can use this same trick of renaming the PR, but you'll also need to delete any \`renovate.json\` file too. You should then get a new "Configure Renovate" PR like this.`
  );

  // Check if existing PR exists
  const onboardBranchName = `${config.branchPrefix}configure`;
  const existingPr = await config.api.getBranchPr(onboardBranchName);
  if (existingPr) {
    // Check if existing PR needs updating
    if (
      existingPr.title === onboardPrTitle &&
      existingPr.body === bodyFormat.getBody()
    ) {
      logger.info(`${existingPr.displayNumber} does not need updating`);
      return;
    }
    // PR must need updating
    await config.api.updatePr(
      existingPr.number,
      onboardPrTitle,
      bodyFormat.getBody()
    );
    logger.info(`Updated ${existingPr.displayNumber}`);
    return;
  }
  const pr = await config.api.createPr(
    onboardBranchName,
    onboardPrTitle,
    bodyFormat.getBody(),
    [], // labels
    true
  );
  logger.debug(`Created ${pr.displayNumber} for configuration`);
}

async function getOnboardingStatus(inputConfig) {
  let config = { ...inputConfig };
  const { logger } = config;
  logger.debug('Checking if repo is onboarded');
  // Check if repository is configured
  if (config.onboarding === false) {
    logger.debug('Repo onboarding is disabled');
    return { ...config, repoIsOnboarded: true };
  }
  if (config.renovateJsonPresent) {
    logger.debug('Repo has renovate.json');
    return { ...config, repoIsOnboarded: true };
  }
  config.onboardingBranch = `${config.branchPrefix}configure`;
  const pr = await config.api.findPr(
    config.onboardingBranch,
    'Configure Renovate'
  );
  if (pr && pr.isClosed) {
    logger.debug('Found closed Configure Renovate PR');
    return { ...config, repoIsOnboarded: true };
  }
  if (pr) {
    logger.debug(`Found existing onboarding PR #${pr.number}`);
  } else {
    config = await module.exports.createOnboardingBranch(config);
  }
  logger.debug('Merging renovate.json from onboarding branch');
  config = await apis.mergeRenovateJson(config, config.onboardingBranch);
  return { ...config, repoIsOnboarded: false };
}
