export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  commitMessageTopic: 'Homebrew Formula {{depName}}',
  fileMatch: ['^Formula/[^/]+[.]rb$'],
};
