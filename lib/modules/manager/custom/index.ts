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

export function get<T extends keyof ManagerApi>(
  manager: string,
  name: T
): ManagerApi[T] | undefined {
  return customManagers.get(manager.replace('custom.', ''))?.[name];
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Result<PackageFileContent | null> {
  if (!config.customType) {
    return null;
  }
  const customMgrName = config.customType;
  const customMgr = customManagers.get(customMgrName);

  return customMgr?.extractPackageFile
    ? customMgr?.extractPackageFile(content, packageFile, config)
    : null;
}
