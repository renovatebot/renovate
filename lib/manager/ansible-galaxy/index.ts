import extractPackageFile from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)requirements\\.ya?ml$', '(^|/)galaxy\\.ya?ml$'],
};
