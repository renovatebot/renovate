import { ProgrammingLanguage } from '../../constants';
import type { RangeStrategy } from '../../types';
import managers from './api';
import type {
  ExtractConfig,
  GlobalManagerConfig,
  ManagerApi,
  PackageFile,
  RangeConfig,
  Result,
} from './types';
export { hashMap } from './fingerprint.generated';
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

export async function detectAllGlobalConfig(): Promise<GlobalManagerConfig> {
  let config: GlobalManagerConfig = {};
  for (const managerName of managerList) {
    const manager = managers.get(managerName);
    if (manager.detectGlobalConfig) {
      // This should use mergeChildConfig once more than one manager is supported, but introduces a cyclic dependency
      config = { ...config, ...(await manager.detectGlobalConfig()) };
    }
  }
  return config;
}

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
    const managerRangeStrategy = m.getRangeStrategy(config);
    if (managerRangeStrategy === 'in-range-only') {
      return 'update-lockfile';
    }
    return managerRangeStrategy;
  }
  if (rangeStrategy === 'auto') {
    // default to 'replace' for auto
    return 'replace';
  }
  if (rangeStrategy === 'in-range-only') {
    return 'update-lockfile';
  }

  return config.rangeStrategy;
}
