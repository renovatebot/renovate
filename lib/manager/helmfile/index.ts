export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  aliases: {
    stable: 'https://kubernetes-charts.storage.googleapis.com/',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)helmfile.yaml$'],
};
