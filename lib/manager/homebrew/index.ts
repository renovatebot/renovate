export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic: 'Homebrew Formula {{depName}}',
  managerBranchPrefix: 'homebrew-',
  fileMatch: ['^Formula/[^/]+[.]rb$'],
};
