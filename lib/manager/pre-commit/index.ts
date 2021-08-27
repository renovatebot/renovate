export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'pre-commit hook {{depName}}',
  fileMatch: ['(^|/)\\.pre-commit-config\\.yaml$'],
};
