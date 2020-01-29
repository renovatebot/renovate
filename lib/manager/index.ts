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
import {
  MANAGER_ANSIBLE,
  MANAGER_BAZEL,
  MANAGER_BUILDKITE,
  MANAGER_BUNDLER,
  MANAGER_CARGO,
  MANAGER_CDN,
  MANAGER_CIRCLE_CI,
  MANAGER_COMPOSER,
  MANAGER_DEPS_EDN,
  MANAGER_DOCKER_COMPOSE,
  MANAGER_DOCKERFILE,
  MANAGER_DRONE_CI,
  MANAGER_GIT_SUBMODULES,
  MANAGER_GITHUB_ACTIONS,
  MANAGER_GITLAB_CI,
  MANAGER_GITLAB_CI_INCLUDE,
  MANAGER_GO_MOD,
  MANAGER_GRADLE,
  MANAGER_GRADLE_WRAPPER,
  MANAGER_HELM_REQUIREMENTS,
  MANAGER_HOMEBREW,
  MANAGER_KUBERNETES,
  MANAGER_LEININGEN,
  MANAGER_MAVEN,
  MANAGER_METEOR,
  MANAGER_MIX,
  MANAGER_NPM,
  MANAGER_NUGET,
  MANAGER_NVM,
  MANAGER_PIP_REQUIREMENTS,
  MANAGER_PIP_SETUP,
  MANAGER_PIPENV,
  MANAGER_POETRY,
  MANAGER_PUB,
  MANAGER_RUBY_VERSION,
  MANAGER_SBT,
  MANAGER_SWIFT,
  MANAGER_TERRAFORM,
  MANAGER_TRAVIS,
} from '../constants/managers';

const managerList = [
  MANAGER_ANSIBLE,
  MANAGER_BAZEL,
  MANAGER_BUILDKITE,
  MANAGER_BUNDLER,
  MANAGER_CARGO,
  MANAGER_CDN,
  MANAGER_CIRCLE_CI,
  MANAGER_COMPOSER,
  MANAGER_DEPS_EDN,
  MANAGER_DOCKER_COMPOSE,
  MANAGER_DOCKERFILE,
  MANAGER_DRONE_CI,
  MANAGER_GIT_SUBMODULES,
  MANAGER_GITHUB_ACTIONS,
  MANAGER_GITLAB_CI,
  MANAGER_GITLAB_CI_INCLUDE,
  MANAGER_GO_MOD,
  MANAGER_GRADLE,
  MANAGER_GRADLE_WRAPPER,
  MANAGER_HELM_REQUIREMENTS,
  MANAGER_HOMEBREW,
  MANAGER_KUBERNETES,
  MANAGER_LEININGEN,
  MANAGER_MAVEN,
  MANAGER_METEOR,
  MANAGER_MIX,
  MANAGER_NPM,
  MANAGER_NUGET,
  MANAGER_NVM,
  MANAGER_PIP_REQUIREMENTS,
  MANAGER_PIP_SETUP,
  MANAGER_PIPENV,
  MANAGER_POETRY,
  MANAGER_PUB,
  MANAGER_SBT,
  MANAGER_SWIFT,
  MANAGER_TERRAFORM,
  MANAGER_TRAVIS,
  MANAGER_RUBY_VERSION,
];

const managers: Record<string, ManagerApi> = {};
for (const manager of managerList) {
  managers[manager] = require(`./${manager}`); // eslint-disable-line
}

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
