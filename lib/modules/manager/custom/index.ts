import type { ManagerApi } from '../types';
import customManagers from './api';

const customManagerList = Array.from(customManagers.keys());
export const getCustomManagerList = (): string[] => customManagerList;
export const getCustomManagers = (): Map<string, ManagerApi> => customManagers;

export {
  defaultConfig,
  extractPackageFile,
  supportedDatasources,
} from './regex';
