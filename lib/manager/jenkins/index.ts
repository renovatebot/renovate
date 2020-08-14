export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)plugins\\.txt'],
  ignoreComments: ['[renovate-ignore]', '[ignore-renovate]'],
};
