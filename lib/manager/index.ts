import {
  ManagerApi,
  ExtractConfig,
  RangeConfig,
  PackageUpdateConfig,
} from './common';

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
  'github-actions',
  'gitlabci',
  'gitlabci-include',
  'gomod',
  'gradle',
  'gradle-wrapper',
  'kubernetes',
  'leiningen',
  'maven',
  'meteor',
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
  'homebrew',
];

const managers: Record<string, ManagerApi> = {};
for (const manager of managerList) {
  managers[manager] = require(`./${manager}`); // eslint-disable-line
}

const languageList = [
  'dart',
  'docker',
  'dotnet',
  'golang',
  'js',
  'node',
  'php',
  'python',
  'ruby',
  'rust',
];

export const get = <T extends keyof ManagerApi>(manager: string, name: T) =>
  managers[manager][name];
export const getLanguageList = () => languageList;
export const getManagerList = () => managerList;

export function extractAllPackageFiles(
  manager: string,
  config: ExtractConfig,
  files: string[]
) {
  return managers[manager] && get(manager, 'extractAllPackageFiles')
    ? get(manager, 'extractAllPackageFiles')(config, files)
    : null;
}

export function getPackageUpdates(
  manager: string,
  config: PackageUpdateConfig
) {
  return managers[manager] && get(manager, 'getPackageUpdates')
    ? get(manager, 'getPackageUpdates')(config)
    : null;
}

export function extractPackageFile(
  manager: string,
  content: string,
  fileName?: string,
  config?: ExtractConfig
) {
  return managers[manager] && get(manager, 'extractPackageFile')
    ? get(manager, 'extractPackageFile')(content, fileName, config)
    : null;
}

export function getRangeStrategy(config: RangeConfig) {
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
