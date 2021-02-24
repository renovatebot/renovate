import { extractAllPackageFiles, extractPackageFile } from './extract';

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)batect(-bundle)?\\.yml$'],
};
