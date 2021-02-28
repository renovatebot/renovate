export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values.yaml$'],
  pinDigests: false,
};
