import { logger } from '../../../logger';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifact } from '../types';

export const delimiters = ['"', "'"];

export function extractRubyVersion(txt: string): string | null {
  const rubyMatch = regEx(/^ruby\s+("[^"]+"|'[^']+')\s*$/gm).exec(txt);
  if (rubyMatch?.length !== 2) {
    return null;
  }
  const quotedVersion = rubyMatch[1];
  return quotedVersion.substring(1, quotedVersion.length - 1);
}

export async function getRubyConstraint(
  updateArtifact: UpdateArtifact,
): Promise<string | null> {
  const { packageFileName, config, newPackageFileContent } = updateArtifact;
  const { constraints = {} } = config;
  const { ruby } = constraints;

  if (ruby) {
    logger.debug('Using ruby constraint from config');
    return ruby;
  } else {
    const rubyMatch = extractRubyVersion(newPackageFileContent);
    if (rubyMatch) {
      logger.debug('Using ruby version from gemfile');
      return rubyMatch;
    }
    const rubyVersionFile = getSiblingFileName(
      packageFileName,
      '.ruby-version',
    );
    const rubyVersionFileContent = await readLocalFile(rubyVersionFile, 'utf8');
    if (rubyVersionFileContent) {
      logger.debug('Using ruby version specified in .ruby-version');
      return rubyVersionFileContent
        .replace(regEx(/^ruby-/), '')
        .replace(regEx(/\n/g), '')
        .trim();
    }
  }
  return null;
}

export function getBundlerConstraint(
  updateArtifact: Pick<UpdateArtifact, 'config'>,
  existingLockFileContent: string,
): string | null {
  const { config } = updateArtifact;
  const { constraints = {} } = config;
  const { bundler } = constraints;

  if (bundler) {
    logger.debug('Using bundler constraint from config');
    return bundler;
  } else {
    const bundledWith = regEx(/\nBUNDLED WITH\n\s+(.*?)(\n|$)/).exec(
      existingLockFileContent,
    );
    if (bundledWith) {
      logger.debug('Using bundler version specified in lockfile');
      return bundledWith[1];
    }
  }
  return null;
}

export async function getLockFilePath(
  packageFilePath: string,
): Promise<string> {
  const lockFilePath = (await localPathExists(`${packageFilePath}.lock`))
    ? `${packageFilePath}.lock`
    : `Gemfile.lock`;
  logger.debug(`Lockfile for ${packageFilePath} found in ${lockFilePath}`);
  return lockFilePath;
}
