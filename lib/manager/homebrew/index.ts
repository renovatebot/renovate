export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic: 'Homebrew Formula {{depName}}',
  additionalBranchPrefix: 'homebrew-',
  fileMatch: ['^Formula/[^/]+[.]rb$'],
};
