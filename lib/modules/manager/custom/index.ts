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

export function get<T extends keyof ManagerApi>(
  manager: string,
  name: T
): ManagerApi[T] | undefined {
  return customManagers.get(manager)?.[name];
}

// hollow function and constants to satisfy existing manager rules
export const defaultConfig = {};
export const supportedDatasources = ['*'];

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Result<PackageFileContent | null> {
  return { deps: [] };
}
