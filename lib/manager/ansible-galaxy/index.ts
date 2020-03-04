import extractPackageFile from './extract';

export { extractPackageFile };

export const autoReplace = true;

export const defaultConfig = {
  fileMatch: ['(^|/)requirements\\.ya?ml$'],
};
