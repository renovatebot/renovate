export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values.yaml$'],
};
