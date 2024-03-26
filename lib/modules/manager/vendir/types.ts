import type { HostRule } from '../../../types';

export interface Vendir {
  kind?: string;
  directories: Directories[];
}

export interface Directories {
  path: string;
  contents: Contents[];
}

export type Contents = HelmChartContent | OtherContent;

export interface HelmChartContent {
  path: string;
  helmChart: HelmChart;
}

export interface OtherContent {
  path: string;
}

export interface HelmChart {
  name: string;
  version: string;
  repository: Repository;
}

export interface Repository {
  url: string;
}

export interface RepositoryRule extends Repository {
  hostRule: HostRule;
}
