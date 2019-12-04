/* eslint-disable import/no-mutable-exports  */

export let appName = 'Renovate';

export let appSlug = 'renovate';

export let configFileNames = [
  'renovate.json',
  'renovate.json5',
  '.github/renovate.json',
  '.github/renovate.json5',
  '.renovaterc',
  '.renovaterc.json',
  'package.json',
];

export let onboardingBranch = 'renovate/configure';
export let onboardingPrTitle = 'Configure Renovate';

export let urls = {
  documentation: 'https://docs.renovatebot.com/',
  help: 'https://github.com/renovatebot/config-help/issues',
  homepage: 'https://renovatebot.com',
};

// istanbul ignore next
export function setAppStrings(appStrings: any): void {
  appName = appStrings.appName;
  appSlug = appStrings.appSlug;
  configFileNames = appStrings.configFileNames;
  onboardingBranch = appStrings.onboardingBranch;
  onboardingPrTitle = appStrings.onboardingPrTitle;
  urls = appStrings.urls;
}
