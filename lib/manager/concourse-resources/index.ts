export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'concourse resources {{depName}}',
  fileMatch: ['(^|/)pipeline.yaml$'],
  pinDigests: false,
};
