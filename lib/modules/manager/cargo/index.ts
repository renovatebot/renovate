import type { Category } from '../../../constants/index.ts';
import { CrateDatasource } from '../../datasource/crate/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';

export { getRangeStrategy } from './range.ts';
export { bumpPackageVersion } from './update.ts';
export { updateLockedDependency } from './update-locked.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['Cargo.lock'];

export { extractPackageFile, updateArtifacts };

export const url = 'https://doc.rust-lang.org/cargo';
export const categories: Category[] = ['rust'];

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
