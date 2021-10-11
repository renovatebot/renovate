export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const defaultConfig = {
  aliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)requirements\\.yaml$'],
};
