import { extractPackageFile } from './extract';

export const autoReplace = true;
export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/).circleci/config.yml$'],
};
