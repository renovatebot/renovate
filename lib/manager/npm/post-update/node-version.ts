import { satisfies, validRange } from 'semver';
import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { isStable } from '../../../versioning/node';
import { PostUpdateConfig } from '../../common';

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
  config: PostUpdateConfig
): Promise<string> | null {
  const { packageFile } = config;
  let constraint =
    (await getNodeFile(getSiblingFileName(packageFile, '.nvmrc'))) ||
    (await getNodeFile(getSiblingFileName(packageFile, '.node-version'))) ||
    getPackageJsonConstraint(config);
  // Avoid using node 15 if node 14 also satisfies the same constraint
  // Remove this once node 16 is LTS
  if (constraint) {
    if (
      validRange(constraint) &&
      satisfies('14.100.0', constraint) &&
      satisfies('15.100.0', constraint) &&
      !isStable('16.100.0') && // this should return false as soon as Node 16 is LTS
      validRange(`${constraint} <15`)
    ) {
      logger.debug('Augmenting constraint to avoid node 15');
      constraint = `${constraint} <15`;
    }
  } else {
    logger.debug('No node constraint found - using latest');
  }
  return constraint;
}
