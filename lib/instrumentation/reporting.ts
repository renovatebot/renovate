import { PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import is from '@sindresorhus/is';
import type { RenovateConfig } from '../config/types';
import { getProblems, logger } from '../logger';
import type { BranchCache } from '../util/cache/repository/types';
import { writeSystemFile } from '../util/fs';
import { getS3Client, parseS3Url } from '../util/s3';
import type { ExtractResult } from '../workers/repository/process/extract-update';
import type { Report } from './types';

const report: Report = {
  problems: [],
  repositories: {},
};

export function addBranchStats(
  config: RenovateConfig,
  branchesInformation: Partial<BranchCache>[],
): void {
  if (is.nullOrUndefined(config.reportType)) {
    return;
  }

  coerceRepo(config.repository!);
  report.repositories[config.repository!].branches = branchesInformation;
}

export function addExtractionStats(
  config: RenovateConfig,
  extractResult: ExtractResult,
): void {
  if (is.nullOrUndefined(config.reportType)) {
    return;
  }

  coerceRepo(config.repository!);
  report.repositories[config.repository!].packageFiles =
    extractResult.packageFiles;
}

export function finalizeReport(): void {
  const allProblems = structuredClone(getProblems());
  for (const problem of allProblems) {
    const repository = problem.repository;
    delete problem.repository;

    // if the problem can be connected to a repository add it their else add to the root list
    if (repository) {
      coerceRepo(repository);
      report.repositories[repository].problems.push(problem);
    } else {
      report.problems.push(problem);
    }
  }
}

export async function exportStats(config: RenovateConfig): Promise<void> {
  try {
    if (is.nullOrUndefined(config.reportType)) {
      return;
    }

    if (config.reportType === 'logging') {
      logger.info({ report }, 'Printing report');
      return;
    }

    if (config.reportType === 'file') {
      const path = config.reportPath!;
      await writeSystemFile(path, JSON.stringify(report));
      logger.debug({ path }, 'Writing report');
      return;
    }

    if (config.reportType === 's3') {
      const s3Url = parseS3Url(config.reportPath!);
      if (is.nullOrUndefined(s3Url)) {
        logger.warn(
          { reportPath: config.reportPath },
          'Failed to parse s3 URL',
        );
        return;
      }

      const s3Params: PutObjectCommandInput = {
        Bucket: s3Url.Bucket,
        Key: s3Url.Key,
        Body: JSON.stringify(report),
        ContentType: 'application/json',
      };

      const client = getS3Client();
      const command = new PutObjectCommand(s3Params);
      await client.send(command);
    }
  } catch (err) {
    logger.warn({ err }, 'Reporting.exportStats() - failure');
  }
}

export function getReport(): Report {
  return structuredClone(report);
}

function coerceRepo(repository: string): void {
  if (!is.undefined(report.repositories[repository])) {
    return;
  }

  report.repositories[repository] = {
    problems: [],
    branches: [],
    packageFiles: {},
  };
}
