import type { HostRule } from '../../../types';

export interface ChartDefinition {
  dependencies: Repository[];
}

export interface Repository {
  name: string;
  repository: string;
}

export interface RepositoryRule extends Repository {
  hostRule: HostRule;
}
