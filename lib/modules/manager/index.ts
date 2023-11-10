import type { RangeStrategy } from '../../types';
import managers from './api';
import { customManagerList, isCustomManager } from './custom';
import customManagers from './custom/api';
import type {
  ExtractConfig,
  GlobalManagerConfig,
  ManagerApi,
  PackageFile,
  PackageFileContent,
  RangeConfig,
  Result,
} from './types';
export { hashMap } from './fingerprint.generated';

const managerList = Array.from(managers.keys()); // does not include custom managers
export const getManagerList = (): string[] => managerList;
export const getManagers = (): Map<string, ManagerApi> => managers;
export const allManagersList = [...managerList, ...customManagerList];

export function get<T extends keyof ManagerApi>(
  manager: string,
  name: T,
): ManagerApi[T] | undefined {
  return isCustomManager(manager)
    ? customManagers.get(manager)?.[name]
    : managers.get(manager)?.[name];
}

export async function detectAllGlobalConfig(): Promise<GlobalManagerConfig> {
  let config: GlobalManagerConfig = {};
  for (const managerName of allManagersList) {
    const manager =
      managers.get(managerName)! ?? customManagers.get(managerName)!;
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
  files: string[],
): Promise<PackageFile[] | null> {
  if (!managers.has(manager)) {
    return null;
  }
  const m = managers.get(manager)!;
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
  fileName: string,
  config: ExtractConfig,
): Result<PackageFileContent | null> {
  const m = managers.get(manager)! ?? customManagers.get(manager)!;
  if (!m) {
    return null;
  }

  return m.extractPackageFile
    ? m.extractPackageFile(content, fileName, config)
    : null;
}

export function getRangeStrategy(config: RangeConfig): RangeStrategy | null {
  const { manager, rangeStrategy } = config;
  if (!manager || !managers.has(manager)) {
    return null;
  }
  const m = managers.get(manager)!;
  if (m.getRangeStrategy) {
    // Use manager's own function if it exists
    const managerRangeStrategy = m.getRangeStrategy(config);
    if (managerRangeStrategy === 'in-range-only') {
      return 'update-lockfile';
    }
    return managerRangeStrategy;
  }
  if (rangeStrategy === 'auto') {
    if (m.updateLockedDependency) {
      return 'update-lockfile';
    }
    // default to 'replace' for auto
    return 'replace';
  }
  if (rangeStrategy === 'in-range-only') {
    return 'update-lockfile';
  }

  return config.rangeStrategy;
}

/**
 * Filter a list of managers based on enabled managers.
 *
 * If enabledManagers is provided, this function returns a subset of allManagersList
 * that matches the enabled manager names, including custom managers. If enabledManagers
 * is not provided or is an empty array, it returns the full list of managers.
 */
export function getEnabledManagersList(enabledManagers?: string[]): string[] {
  if (enabledManagers?.length) {
    return allManagersList.filter(
      (manager) =>
        enabledManagers.includes(manager) ||
        enabledManagers.includes(`custom.${manager}`),
    );
  }

  return allManagersList;
}
