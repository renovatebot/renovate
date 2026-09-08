import { logger } from '../../../logger/index.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { UpdateArtifact } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';

export const delimiters = ['"', "'"];

export function extractRubyVersion(txt: string): string | null {
  const rubyMatch = regEx(/^ruby\s+(?<version>"[^"]+"|'[^']+')\s*$/gm).exec(
    txt,
  );
  if (!rubyMatch?.groups) {
    return null;
  }
  const quotedVersion = rubyMatch.groups.version;
  return quotedVersion.substring(1, quotedVersion.length - 1);
}

async function getRubyConstraintFromFiles(
  packageFileName: string,
  newPackageFileContent: string,
): Promise<string | null> {
  const rubyMatch = extractRubyVersion(newPackageFileContent);
  if (rubyMatch) {
    logger.debug('Using ruby version from gemfile');
    return rubyMatch;
  }
  for (const file of ['.ruby-version', '.tool-versions']) {
    const rubyVersion = (
      await readLocalFile(getSiblingFileName(packageFileName, file), 'utf8')
    )?.match(regEx(/^(?:ruby(?:-|\s+))?(?<version>\d[\d.]*)/m))?.groups
      ?.version;
    if (rubyVersion) {
      logger.debug(`Using ruby version specified in ${file}`);
      return rubyVersion;
    }
  }
  const lockFile = await getLockFilePath(packageFileName);
  if (lockFile) {
    const rubyVersion = (await readLocalFile(lockFile, 'utf8'))?.match(
      regEx(/^ {3}ruby (?<version>\d[\d.]*)(?:[a-z]|\s|$)/m),
    )?.groups?.version;
    if (rubyVersion) {
      logger.debug(`Using ruby version specified in lock file`);
      return rubyVersion;
    }
  }

  return null;
}

export async function getRubyConstraint(
  updateArtifact: UpdateArtifact,
): Promise<string | undefined> {
  const { packageFileName, config, newPackageFileContent } = updateArtifact;
  return await resolveToolConstraint(config, 'ruby', () =>
    getRubyConstraintFromFiles(packageFileName, newPackageFileContent),
  );
}

function getBundlerConstraintFromLockFile(
  existingLockFileContent: string,
): string | null {
  const bundledWith = regEx(/\nBUNDLED WITH\n\s+(?<version>.*?)(?:\n|$)/).exec(
    existingLockFileContent,
  );
  if (bundledWith) {
    logger.debug('Using bundler version specified in lockfile');
    return bundledWith.groups!.version;
  }

  return null;
}

export async function getBundlerConstraint(
  updateArtifact: Pick<UpdateArtifact, 'config'>,
  existingLockFileContent: string,
): Promise<string | undefined> {
  const { config } = updateArtifact;
  return await resolveToolConstraint(config, 'bundler', () =>
    getBundlerConstraintFromLockFile(existingLockFileContent),
  );
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
