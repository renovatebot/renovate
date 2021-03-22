// istanbul ignore file: types only
export interface Repo {
  name?: string;
  type: 'composer' | 'git' | 'package' | 'vcs';
  packagist?: boolean;
  'packagist.org'?: boolean;
  url: string;
}
export interface ComposerConfig {
  type?: string;
  /**
   * A repositories field can be an array of Repo objects or an object of repoName: Repo
   * Also it can be a boolean (usually false) to disable packagist.
   * (Yes this can be confusing, as it is also not properly documented in the composer docs)
   * See https://getcomposer.org/doc/05-repositories.md#disabling-packagist-org
   */
  repositories?: Record<string, Repo | boolean> | Repo[];

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
