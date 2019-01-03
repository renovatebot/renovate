const appName = 'Renovate';

const appSlug = 'renovate';

const configFileNames = [
  'renovate.json',
  '.github/renovate.json',
  '.renovaterc',
  '.renovaterc.json',
  'package.json',
];

const packageJsonConfigSection = 'renovate';

const onboardingBranch = 'renovate/configure';
const onboardingPrTitle = 'Configure Renovate';

module.exports = {
  appName,
  appSlug,
  configFileNames,
  onboardingBranch,
  onboardingPrTitle,
  packageJsonConfigSection,
};
