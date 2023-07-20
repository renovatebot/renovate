import type {
  ExtractConfig,
  ManagerApi,
  PackageFileContent,
  Result,
} from '../types';
import customManagers from './api';

const customManagerList = Array.from(customManagers.keys());
export const getCustomManagerList = (): string[] => customManagerList;
export const getCustomManagers = (): Map<string, ManagerApi> => customManagers;

export const defaultConfig = {};
export const supportedDatasources = ['*'];

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Result<PackageFileContent | null> {
  const customMgr = config.customType;

  if (!customMgr || !customManagers.has(customMgr)) {
    return null;
  }
  const m = customManagers.get(customMgr)!;
  return m.extractPackageFile
    ? m.extractPackageFile(content, fileName, config)
    : null;
}
