import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: [
    '^(workflow-templates|\\.github\\/workflows)\\/[^/]+\\.ya?ml$',
    '^action\\.[yY][aA]?[mM][lL]$',
  ],
};
