export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'pre-commit hook {{depName}}',
  enabled: false,
  fileMatch: ['(^|/)\\.pre-commit-config\\.yaml$'],
};
