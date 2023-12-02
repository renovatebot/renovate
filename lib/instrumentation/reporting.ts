import { writeFileSync } from 'fs';
import { PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import is from '@sindresorhus/is';
import type { RenovateConfig } from '../config/types';
import { logger } from '../logger';
import type { BranchCache } from '../util/cache/repository/types';
import { getS3Client, parseS3Url } from '../util/s3';
import type { ExtractResult } from '../workers/repository/process/extract-update';
import type { Report } from './types';

const result: Report = {
  repositories: {},
};

export function addBranchStats(
  config: RenovateConfig,
  branchesInformation: Partial<BranchCache>[],
): void {
  coerceRepo(config.repository!);
  result.repositories[config.repository!].branches = branchesInformation;
}

export function addExtractionStats(
  config: RenovateConfig,
  extractResult: ExtractResult,
): void {
  coerceRepo(config.repository!);
  result.repositories[config.repository!].packageFiles =
    extractResult.packageFiles;
}

export async function exportStats(config: RenovateConfig): Promise<void> {
  try {
    if (is.nullOrUndefined(config.reportType)) {
      return;
    }

    if (config.reportType === 'logging') {
      logger.info({ result }, 'Printing report');
      return;
    }

    if (config.reportType === 'file') {
      const path = config.reportPath;
      if (!is.nonEmptyString(path)) {
        logger.warn(
          'No reportPath has been provided while using reportType `file`',
        );
        return;
      }

      writeFileSync(path, JSON.stringify(result));
      logger.debug({ path }, 'Writing report');
      return;
    }

    if (config.reportType === 's3') {
      if (is.nullOrUndefined(config.reportPath)) {
        logger.warn(
          'No reportPath has been provided while using reportType `s3`',
        );
        return;
      }
      const s3Url = parseS3Url(config.reportPath);
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
        Body: JSON.stringify(result),
        ContentType: 'application/json',
      };

      await getS3Client().send(new PutObjectCommand(s3Params));
    }
  } catch (err) {
    logger.warn({ err }, 'Reporting.exportStats() - failure');
  }
}

function coerceRepo(repository: string): void {
  if (!is.undefined(result.repositories[repository])) {
    return;
  }

  result.repositories[repository] = {
    branches: [],
    packageFiles: {},
  };
}
