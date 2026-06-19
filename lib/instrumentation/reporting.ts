import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { isNullOrUndefined, isUndefined } from '@sindresorhus/is';
import { GlobalConfig } from '../config/global.ts';
import type { RenovateConfig } from '../config/types.ts';
import { prettier } from '../expose.ts';
import { getProblems, logger } from '../logger/index.ts';
import type { BranchCache } from '../util/cache/repository/types.ts';
import { writeSystemFile } from '../util/fs/index.ts';
import { getS3Client, parseS3Url } from '../util/s3.ts';
import type { ExtractResult } from '../workers/repository/process/extract-update.ts';
import type { LibYearsWithStatus, Report } from './types.ts';

const report: Report = {
  problems: [],
  repositories: {},
};

/**
 * Reset the report
 * Should only be used for testing
 */
export function resetReport(): void {
  report.problems = [];
  report.repositories = {};
}

export function addBranchStats(
  config: RenovateConfig,
  branchesInformation: Partial<BranchCache>[],
): void {
  if (isNullOrUndefined(GlobalConfig.get('reportType'))) {
    return;
  }

  coerceRepo(config.repository!);
  report.repositories[config.repository!].branches = branchesInformation;
}

export function addExtractionStats(
  config: RenovateConfig,
  extractResult: ExtractResult,
): void {
  if (isNullOrUndefined(GlobalConfig.get('reportType'))) {
    return;
  }

  coerceRepo(config.repository!);
  report.repositories[config.repository!].packageFiles =
    extractResult.packageFiles;
}

export function addLibYears(
  config: RenovateConfig,
  libYearsWithDepCount: LibYearsWithStatus,
): void {
  if (isNullOrUndefined(GlobalConfig.get('reportType'))) {
    return;
  }

  coerceRepo(config.repository!);
  report.repositories[config.repository!].libYearsWithStatus =
    libYearsWithDepCount;
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

async function getReportBody(): Promise<string> {
  const json = JSON.stringify(report);
  if (!GlobalConfig.get('reportFormatting')) {
    return json;
  }
  return prettier().format(json, { parser: 'json' });
}

export async function exportStats(): Promise<void> {
  try {
    const reportType = GlobalConfig.get('reportType');
    if (isNullOrUndefined(reportType)) {
      return;
    }

    if (reportType === 'logging') {
      logger.info({ report }, 'Printing report');
      return;
    }

    if (reportType === 'file') {
      const path = GlobalConfig.get('reportPath');
      await writeSystemFile(path, await getReportBody());
      logger.debug({ path }, 'Writing report');
      return;
    }

    // v8 ignore else -- TODO: add test #40625
    if (reportType === 's3') {
      const reportPath = GlobalConfig.get('reportPath');
      const s3Url = parseS3Url(reportPath);
      if (isNullOrUndefined(s3Url)) {
        logger.warn({ reportPath }, 'Failed to parse s3 URL');
        return;
      }

      const s3Params: PutObjectCommandInput = {
        Bucket: s3Url.Bucket,
        Key: s3Url.Key,
        Body: await getReportBody(),
        ContentType: 'application/json',
      };

      const client = getS3Client(
        GlobalConfig.get('s3Endpoint'),
        GlobalConfig.get('s3PathStyle'),
      );
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
  if (!isUndefined(report.repositories[repository])) {
    return;
  }

  report.repositories[repository] = {
    problems: [],
    branches: [],
    packageFiles: {},
  };
}
