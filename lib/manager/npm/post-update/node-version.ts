import { satisfies, validRange } from 'semver';
import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { isStable } from '../../../versioning/node';
import type { PostUpdateConfig } from '../../types';

async function getNodeFile(filename: string): Promise<string> | null {
  try {
    const constraint = (await readLocalFile(filename, 'utf8'))
      .split('\n')[0]
      .replace(/^v/, '');
    if (validRange(constraint)) {
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
  if (constraint && validRange(constraint)) {
    logger.debug(`Using node constraint "${constraint}" from package.json`);
    return constraint;
  }
  return null;
}

export async function getNodeConstraint(
  config: PostUpdateConfig,
  allowUnstable = false
): Promise<string> | null {
  const { packageFile } = config;
  let constraint =
    (await getNodeFile(getSiblingFileName(packageFile, '.nvmrc'))) ||
    (await getNodeFile(getSiblingFileName(packageFile, '.node-version'))) ||
    getPackageJsonConstraint(config);
  let lockfileVersion = 1;
  try {
    const lockFileName = getSiblingFileName(packageFile, 'package-lock.json');
    lockfileVersion = JSON.parse(await readLocalFile(lockFileName, 'utf8'))
      .lockfileVersion;
  } catch (err) {
    // do nothing
  }
  // Avoid using node 15 if node 14 also satisfies the same constraint
  // Remove this once node 16 is LTS
  if (constraint) {
    if (
      validRange(constraint) &&
      satisfies('14.100.0', constraint) &&
      satisfies('15.100.0', constraint) &&
      !isStable('16.100.0')
    ) {
      if (lockfileVersion === 2) {
        logger.debug('Forcing node 15 to ensure lockfileVersion=2 is used');
        constraint = '>=15';
      } else if (validRange(`${constraint} <15`)) {
        logger.debug('Augmenting constraint to avoid node 15');
        constraint = `${constraint} <15`;
      }
    }
  } else if (allowUnstable && lockfileVersion === 2) {
    logger.debug('Using node >=15 for lockfileVersion=2');
    constraint = '>=15';
  } else {
    logger.debug('No node constraint found - using latest');
  }
  return constraint;
}
