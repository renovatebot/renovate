import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const url = 'https://kubectl.docs.kubernetes.io/references/kustomize';
export const categories: Category[] = ['kubernetes'];

export const defaultConfig = {
  fileMatch: ['(^|/)kustomization\\.ya?ml$'],
  pinDigests: false,
};

export const supportedDatasources = [
  DockerDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  HelmDatasource.id,
];
