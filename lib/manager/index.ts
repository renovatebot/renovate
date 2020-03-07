import {
  ExtractConfig,
  ManagerApi,
  PackageFile,
  PackageUpdateConfig,
  RangeConfig,
  Result,
  PackageUpdateResult,
} from './common';
import { RangeStrategy } from '../types';
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
import { loadModules } from '../util/modules';
import { logger } from '../logger';

// istanbul ignore next
function validateManager(manager): boolean {
  if (!manager.defaultConfig) {
    logger.fatal(`manager is missing defaultConfig`);
    return false;
  }
  if (!manager.updateDependency && !manager.autoReplace) {
    logger.fatal(`manager is missing updateDependency`);
    return false;
  }
  if (!manager.extractPackageFile && !manager.extractAllPackageFiles) {
    logger.fatal(
      `manager must support extractPackageFile or extractAllPackageFiles`
    );
  }
  return true;
}

const managers = loadModules<ManagerApi>(__dirname, validateManager);
const managerList = Object.keys(managers);

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

export const get = <T extends keyof ManagerApi>(
  manager: string,
  name: T
): ManagerApi[T] => managers[manager][name];
export const getLanguageList = (): string[] => languageList;
export const getManagerList = (): string[] => managerList;
export const getManagers = (): Record<string, ManagerApi> => managers;

export function extractAllPackageFiles(
  manager: string,
  config: ExtractConfig,
  files: string[]
): Result<PackageFile[] | null> {
  return managers[manager] && managers[manager].extractAllPackageFiles
    ? managers[manager].extractAllPackageFiles(config, files)
    : null;
}

export function getPackageUpdates(
  manager: string,
  config: PackageUpdateConfig
): Result<PackageUpdateResult[]> | null {
  return managers[manager] && managers[manager].getPackageUpdates
    ? managers[manager].getPackageUpdates(config)
    : null;
}

export function extractPackageFile(
  manager: string,
  content: string,
  fileName?: string,
  config?: ExtractConfig
): Result<PackageFile | null> {
  return managers[manager] && managers[manager].extractPackageFile
    ? managers[manager].extractPackageFile(content, fileName, config)
    : null;
}

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const { manager, rangeStrategy } = config;
  if (managers[manager].getRangeStrategy) {
    // Use manager's own function if it exists
    return managers[manager].getRangeStrategy(config);
  }
  if (rangeStrategy === 'auto') {
    // default to 'replace' for auto
    return 'replace';
  }
  return config.rangeStrategy;
}
