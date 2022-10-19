// istanbul ignore file: types only
export interface Repo {
  name?: string;
  type: 'composer' | 'git' | 'package' | 'vcs';
  packagist?: boolean;
  'packagist.org'?: boolean;
  url: string;
}
export type ComposerRepositories = Record<string, Repo | boolean> | Repo[];

export interface ComposerConfig {
  type?: string;
  /**
   * Setting a fixed PHP version (e.g. {"php": "7.0.3"}) will let you fake the
   * platform version so that you can emulate a production env or define your
   * target platform in the config.
   * See https://getcomposer.org/doc/06-config.md#platform
   */
  config?: {
    platform?: {
      php?: string;
    };
  };
  /**
   * A repositories field can be an array of Repo objects or an object of repoName: Repo
   * Also it can be a boolean (usually false) to disable packagist.
   * (Yes this can be confusing, as it is also not properly documented in the composer docs)
   * See https://getcomposer.org/doc/05-repositories.md#disabling-packagist-org
   */
  repositories?: ComposerRepositories;

  require?: Record<string, string>;
  'require-dev'?: Record<string, string>;
}

export interface ComposerLockPackage {
  name: string;
  version: string;
}

export interface ComposerLock {
  'plugin-api-version'?: string;
  packages?: ComposerLockPackage[];
  'packages-dev'?: ComposerLockPackage[];
}

export interface ComposerManagerData {
  composerJsonType?: string;
}

export interface UserPass {
  username: string;
  password: string;
}

export interface AuthJson {
  bearer?: Record<string, string>;
  'github-oauth'?: Record<string, string>;
  'gitlab-token'?: Record<string, string>;
  'gitlab-domains'?: string[];
  'http-basic'?: Record<string, UserPass>;
}
