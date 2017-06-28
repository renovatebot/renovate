const handlebars = require('handlebars');
const stringify = require('json-stringify-pretty-compact');

const defaultsParser = require('../../config/defaults');

const onboardBranchName = 'renovate/configure';
const onboardPrTitle = 'Configure Renovate';

module.exports = {
  createBranch,
  ensurePr,
  getOnboardingStatus,
};

async function createBranch(config) {
  const defaultConfig = defaultsParser.getOnboardingConfig();
  const defaultConfigString = `${stringify(defaultConfig)}\n`;
  await config.api.commitFilesToBranch(
    onboardBranchName,
    [
      {
        name: 'renovate.json',
        contents: defaultConfigString,
      },
    ],
    'Add renovate.json'
  );
}

async function ensurePr(config, branchUpgrades) {
  const onboardBranchNames = Object.keys(branchUpgrades);
  let prBody = `Welcome to [Renovate](https://keylocation.sg/our-tech/renovate)! Once you close this Pull Request, we will begin keeping your dependencies up-to-date via automated Pull Requests.

---

### Anticipated Pull Requests

With your current configuration, renovate will initially create ${onboardBranchNames.length} branches/Pull Requests:

PRDESCRIPTION

---

The [Configuration](https://github.com/singapore/renovate/blob/master/docs/configuration.md) and [Configuration FAQ](https://github.com/singapore/renovate/blob/master/docs/faq.md) documents should be helpful.

#### Important!

You do not need to *merge* this Pull Request - renovate will begin even if it's closed *unmerged*.
In fact, you only need to add a \`renovate.json\` file to your repository if you wish to override any default settings. The file is included as part of this PR only in case you wish to change default settings before you start.

If the default settings are all suitable for you, simply close this Pull Request unmerged and your first renovation will begin the next time the program is run.`;
  let prDesc = '';
  onboardBranchNames.forEach((branchName, index) => {
    const upgrades = branchUpgrades[branchName];
    const upgrade0 = upgrades[0];
    const prTitle = handlebars.compile(upgrade0.prTitle)(upgrade0);
    if (onboardBranchNames.length > 1) {
      prDesc += `${index + 1}. `;
    }
    prDesc += `**${prTitle}**\n`;
    prDesc += `   - Branch name: \`${branchName}\`\n`;
    upgrades.forEach(upgrade => {
      if (upgrade.isPin) {
        prDesc += '   - Pins ';
      } else {
        prDesc += '   - Upgrades ';
      }
      prDesc += `[${upgrade.depName}](${upgrade.repositoryUrl}) in \`${upgrade.depType}\` from \`${upgrade.currentVersion}\` to \`${upgrade.newVersion}\`\n`;
    });
    prDesc += '\n';
  });
  prBody = prBody.replace('PRDESCRIPTION', prDesc);
  if (config.platform === 'gitlab') {
    prBody = prBody.replace(/Pull Request/g, 'Merge Request');
  }
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
    if (pr.isClosed) {
      config.logger.debug('Found closed Configure Renovate PR');
      return true;
    }
    // PR exists but hasn't been closed yet
    config.logger.debug(
      `PR #${pr.displayNumber} needs to be closed to enable renovate to continue`
    );
    return false;
  }
  await module.exports.createBranch(config);
  return false;
}
