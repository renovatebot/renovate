import { pkg } from '../../expose.cjs';
import { logger } from '../../logger';
import type { BunyanRecord } from '../../logger/types';
import * as memCache from '../cache/memory';
import { readFile, writeFile } from '../fs';
import type { RenovateStats, RepositoryStats } from './types';

export abstract class RepositoryStatisticsReporter {
  public static initRepoStats(repoName: string): void {
    const repositoryStats = {
      startedAt: new Date().toISOString(),
      dependencyUpdates: [],
    } as RepositoryStats;
    memCache.set('repo-stats', repositoryStats);
  }
  public static save(stats: RepositoryStats): void {
    memCache.set('repo-stats', stats);
  }

  public static get(): RepositoryStats {
    return memCache.get<RepositoryStats>('repo-stats');
  }

  public static async initReportFile(
    startTime: string,
    filePath: string,
    renovateEndpoint: string
  ): Promise<void> {
    const renovateStats = {
      startTime: startTime,
      renovateVersion: pkg.version,
      renovateEndpoint,
      repositories: [],
    } as RenovateStats;

    const stats = JSON.stringify(renovateStats);
    await writeFile(filePath, stats);
  }

  public static async finalizeReportFile(
    filePath: string,
    loggerErrors: BunyanRecord[]
  ): Promise<void> {
    const report = JSON.parse(
      await readFile(filePath, 'utf8')
    ) as RenovateStats;
    if (!report) {
      logger.warn(
        { filePath },
        'Report file does not exist. This is unexpected.'
      );
      return;
    }
    report.endTime = new Date().toISOString();
    report.loggerErrors = loggerErrors;
    const stats = JSON.stringify(report);
    await writeFile(filePath, stats);
  }

  public static async saveStatsToReportFile(filePath: string): Promise<void> {
    if (!filePath) {
      return;
    }
    const report = JSON.parse(
      await readFile(filePath, 'utf8')
    ) as RenovateStats;
    if (!report) {
      logger.warn(
        { filePath },
        'Report file does not exist. This is unexpected.'
      );
      return;
    }
    const repositoryStats = memCache.get<RepositoryStats>('repo-stats');

    report.repositories.push(repositoryStats);

    const stats = JSON.stringify(report);
    await writeFile(filePath, stats);
  }

  static setPrState(prNo: number, state: string): void {
    memCache.set(`repo-stats-pr-${prNo}`, state);
  }

  static setBranchState(branchName: string, state: string): void {
    memCache.set(`repo-stats-branch-${branchName}`, state);
  }

  static getBranchState(branchName: string): string {
    return memCache.get<string>(`repo-stats-branch-${branchName}`);
  }
  static getPrState(prNo: number): string {
    return memCache.get<string>(`repo-stats-pr-${prNo}`);
  }
}
