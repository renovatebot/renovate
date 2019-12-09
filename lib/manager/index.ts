import {
  ExtractConfig,
  ManagerApi,
  PackageFile,
  PackageUpdateConfig,
  RangeConfig,
  Result,
  PackageUpdateResult,
} from './common';
import { RangeStrategy } from '../versioning';

const managerList = [
  'ansible',
  'bazel',
  'buildkite',
  'bundler',
  'cargo',
  'circleci',
  'composer',
  'deps-edn',
  'docker-compose',
  'dockerfile',
  'droneci',
  'git-submodules',
  'github-actions',
  'gitlabci',
  'gitlabci-include',
  'gomod',
  'gradle',
  'gradle-wrapper',
  'helm-requirements',
  'homebrew',
  'kubernetes',
  'leiningen',
  'maven',
  'meteor',
  'mix',
  'npm',
  'nuget',
  'nvm',
  'pip_requirements',
  'pip_setup',
  'pipenv',
  'poetry',
  'pub',
  'sbt',
  'swift',
  'terraform',
  'travis',
  'ruby-version',
];

const managers: Record<string, ManagerApi> = {};
for (const manager of managerList) {
  managers[manager] = require(`./${manager}`); // eslint-disable-line
}

const languageList = [
  'dart',
  'docker',
  'dotnet',
  'elixir',
  'golang',
  'js',
  'node',
  'php',
  'python',
  'ruby',
  'rust',
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
