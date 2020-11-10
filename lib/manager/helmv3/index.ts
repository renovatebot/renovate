export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  aliases: {
    stable: 'https://kubernetes-charts.storage.googleapis.com/',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)Chart.yaml$'],
};
