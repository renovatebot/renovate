import fs from 'fs';
import { logger } from '../logger';

import {
  ExtractConfig,
  ManagerApi,
  PackageFile,
  PackageUpdateConfig,
  RangeConfig,
  Result,
  PackageUpdateResult,
} from './common';

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

type RangeStrategy =
  | 'auto'
  | 'bump'
  | 'future'
  | 'pin'
  | 'replace'
  | 'update-lockfile'
  | 'widen';

const managerList = [];
const managers: Record<string, ManagerApi> = {};

function isValidManagerModule(module: unknown): module is ManagerApi {
  // TODO: check interface and fail-fast?
  return !!module;
}

function loadManagers(): void {
  const managerDirs = fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort();
  for (const manager of managerDirs) {
    let module = null;
    try {
      module = require(`./${manager}`); // eslint-disable-line
    } catch (e) /* istanbul ignore next */ {
      logger.fatal(`Can not load manager "${manager}".`);
      process.exit(1);
    }

    if (isValidManagerModule(module)) {
      managers[manager] = module;
      managerList.push(manager);
    }
  }
}
loadManagers();

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
