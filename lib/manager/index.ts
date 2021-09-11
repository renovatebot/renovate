import { ProgrammingLanguage } from '../constants/programming-language';
import type { RangeStrategy } from '../types';
import managers from './api';
import type {
  ExtractConfig,
  ManagerApi,
  PackageFile,
  RangeConfig,
  Result,
} from './types';

const managerList = Array.from(managers.keys());

const languageList = Object.values(ProgrammingLanguage);

export function get<T extends keyof ManagerApi>(
  manager: string,
  name: T
): ManagerApi[T] | null {
  return managers.get(manager)?.[name];
}
export const getLanguageList = (): string[] => languageList;
export const getManagerList = (): string[] => managerList;
export const getManagers = (): Map<string, ManagerApi> => managers;

export async function extractAllPackageFiles(
  manager: string,
  config: ExtractConfig,
  files: string[]
): Promise<PackageFile[] | null> {
  if (!managers.has(manager)) {
    return null;
  }
  const m = managers.get(manager);
  if (m.extractAllPackageFiles) {
    const res = await m.extractAllPackageFiles(config, files);
    // istanbul ignore if
    if (!res) {
      return null;
    }
    return res;
  }
  return null;
}

export function extractPackageFile(
  manager: string,
  content: string,
  fileName?: string,
  config?: ExtractConfig
): Result<PackageFile | null> {
  if (!managers.has(manager)) {
    return null;
  }
  const m = managers.get(manager);
  return m.extractPackageFile
    ? m.extractPackageFile(content, fileName, config)
    : null;
}

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const { manager, rangeStrategy } = config;
  if (!managers.has(manager)) {
    return null;
  }
  const m = managers.get(manager);
  if (m.getRangeStrategy) {
    // Use manager's own function if it exists
    return m.getRangeStrategy(config);
  }
  if (rangeStrategy === 'auto') {
    // default to 'replace' for auto
    return 'replace';
  }
  return config.rangeStrategy;
}
