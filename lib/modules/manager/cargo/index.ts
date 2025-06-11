import type { Category } from '../../../constants';
import { CrateDatasource } from '../../datasource/crate';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';
export { getRangeStrategy } from './range';
export { updateLockedDependency } from './update-locked';

export const supportsLockFileMaintenance = true;

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
