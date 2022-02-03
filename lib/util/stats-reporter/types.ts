import type { BunyanRecord } from '../../logger/types';

export interface DependencyStats {
  branch: string;
  branchState: string;
  branchStatus: string;
  prState: string;
  prNumber: number;
  prCreatedAt: string;
  prClosedAt: string;
  prUpdatedAt: string;
  depName: string;
  depCurrentVersion: string;
  depNewVersion: string;
  depCurrentDigest: string;
  depNewDigest: string;
  datasource: string;
}

export interface RepositoryStats {
  repository: string;
  startedAt: string;
  endedAt: string;
  dependencyUpdates: DependencyStats[];
}

export interface RenovateStats {
  startTime: string;
  endTime: string;
  renovateVersion: string;
  renovateEndpoint: string;
  repositories: RepositoryStats[];
  loggerErrors: BunyanRecord[];
}
