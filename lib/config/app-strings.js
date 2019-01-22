const appName = 'Renovate';

const appSlug = 'renovate';

const configFileNames = [
  'renovate.json',
  '.github/renovate.json',
  '.renovaterc',
  '.renovaterc.json',
  'package.json',
];

const onboardingBranch = 'renovate/configure';
const onboardingPrTitle = 'Configure Renovate';

const urls = {
  documentation: 'https://renovatebot.com/docs/',
  help: 'https://github.com/renovatebot/config-help/issues',
  homepage: 'https://renovatebot.com',
};

module.exports = {
  appName,
  appSlug,
  configFileNames,
  onboardingBranch,
  onboardingPrTitle,
  urls,
};
