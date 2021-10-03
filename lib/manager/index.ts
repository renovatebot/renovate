import {
  LANGUAGE_DART,
  LANGUAGE_DOCKER,
  LANGUAGE_DOT_NET,
  LANGUAGE_ELIXIR,
  LANGUAGE_GOLANG,
  LANGUAGE_JAVASCRIPT,
  LANGUAGE_NODE,
  LANGUAGE_PHP,
  LANGUAGE_PYTHON,
  LANGUAGE_RUBY,
  LANGUAGE_RUST,
} from '../constants/languages';
import type { RangeStrategy } from '../types';
import managers from './api';
import type {
  ExtractConfig,
  GlobalManagerConfig,
  ManagerApi,
  PackageFile,
  RangeConfig,
  Result,
} from './types';

const managerList = Array.from(managers.keys());

const languageList = [
  LANGUAGE_DART,
  LANGUAGE_DOCKER,
  LANGUAGE_DOT_NET,
  LANGUAGE_ELIXIR,
  LANGUAGE_GOLANG,
  LANGUAGE_JAVASCRIPT,
  LANGUAGE_NODE,
  LANGUAGE_PHP,
  LANGUAGE_PYTHON,
  LANGUAGE_RUBY,
  LANGUAGE_RUST,
];

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
    return m.getRangeStrategy(config);
  }
  if (rangeStrategy === 'auto') {
    // default to 'replace' for auto
    return 'replace';
  }
  return config.rangeStrategy;
}
