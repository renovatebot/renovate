import semver from 'semver';
import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { PostUpdateConfig } from '../../types';

async function getNodeFile(filename: string): Promise<string> | null {
  try {
    const constraint = (await readLocalFile(filename, 'utf8'))
      .split('\n')[0]
      .replace(regEx(/^v/), '');
    if (semver.validRange(constraint)) {
      logger.debug(`Using node constraint "${constraint}" from ${filename}`);
      return constraint;
    }
  } catch (err) {
    // do nothing
  }
  return null;
}

function getPackageJsonConstraint(config: PostUpdateConfig): string | null {
  const constraint: string = config.constraints?.node;
  if (constraint && semver.validRange(constraint)) {
    logger.debug(`Using node constraint "${constraint}" from package.json`);
    return constraint;
  }
  return null;
}

export async function getNodeConstraint(
  config: PostUpdateConfig
): Promise<string> | null {
  const { packageFile } = config;
  const constraint =
    (await getNodeFile(getSiblingFileName(packageFile, '.nvmrc'))) ||
    (await getNodeFile(getSiblingFileName(packageFile, '.node-version'))) ||
    getPackageJsonConstraint(config);
  if (!constraint) {
    logger.debug('No node constraint found - using latest');
  }
  return constraint;
}
