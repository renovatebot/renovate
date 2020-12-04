export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'precommit hook {{depName}}',
  fileMatch: ['(^|/)\\.pre-commit-config\\.yaml$'],
};
