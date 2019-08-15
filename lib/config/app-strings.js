const appName = 'Renovate';

const appSlug = 'renovate';

const configFileNames = [
  'renovate.json',
  'renovate.json5',
  '.github/renovate.json',
  '.github/renovate.json5',
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

export {
  appName,
  appSlug,
  configFileNames,
  onboardingBranch,
  onboardingPrTitle,
  urls,
};
