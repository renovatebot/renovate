import type { Category } from '../../../constants/index.ts';
import { CrateDatasource } from '../../datasource/crate/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import type { MinimumReleaseAgeSupport } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';
import { minPublishAgeRustRange } from './minimum-release-age.ts';

export { enforcesMinimumReleaseAge } from './minimum-release-age.ts';
export { getRangeStrategy } from './range.ts';
export { bumpPackageVersion } from './update.ts';
export { updateLockedDependency } from './update-locked.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['Cargo.lock'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export { extractPackageFile, updateArtifacts };

export const url = 'https://doc.rust-lang.org/cargo';
export const categories: Category[] = ['rust'];

export const minimumReleaseAgeSupport: MinimumReleaseAgeSupport = {
  rust: {
    passesMinimumReleaseAge: minPublishAgeRustRange,
    readsConfiguredAge: minPublishAgeRustRange,
    enforcedInLockFile: minPublishAgeRustRange,
    note: 'Only with `minimumReleaseAgePackageManagerSync`. Sets `CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE` to the `minimumReleaseAge` of the repository or manager config, unless cargo applies the same age itself. Reads `registry.global-min-publish-age` and `registries.<name>.min-publish-age` from the repository `.cargo/config`, or `.cargo/config.toml`. Renovate relies on the enforcement only with `RENOVATE_X_CARGO_MIN_PUBLISH_AGE`, a Rust constraint of at least 1.100.0, no git sources in the lock file, and no per-registry `min-publish-age` which is invalid, `"0"` or smaller than the `minimumReleaseAge` of lock file maintenance.',
  },
};

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  managerFilePatterns: ['/(^|/)Cargo\\.toml$/'],
};

export const supportedDatasources = [
  CrateDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  GitRefsDatasource.id,
  GitTagsDatasource.id,
];
