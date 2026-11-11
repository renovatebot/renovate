import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import type { GemspecLockFile } from './types.ts';

const specNameRegex = regEx(
  /^[ \t]*[\w:.]+\.name\s*=\s*['"](?<name>[^'"]+)['"]/m,
);
const pathRemoteRegex = regEx(/^ {2}remote: (?<remote>.+)$/);
const pathSpecRegex = regEx(/^ {4}(?<name>\S+) \(/);

/** Returns the literal `spec.name` of a gemspec, or else its file name. */
function getGemName(gemspecFile: string, gemspecContent: string): string {
  return (
    specNameRegex.exec(gemspecContent)?.groups?.name ??
    upath.basename(gemspecFile, '.gemspec')
  );
}

/** Whether a `PATH` section with `remote: .` lists the gem `gemName`. */
function locksGemFromOwnDirectory(
  lockFileContent: string,
  gemName: string,
): boolean {
  let inPathSection = false;
  let remote: string | undefined;
  for (const line of lockFileContent.split(newlineRegex)) {
    if (!line.startsWith(' ')) {
      inPathSection = line.trim() === 'PATH';
      remote = undefined;
      continue;
    }
    if (!inPathSection) {
      continue;
    }

    const remoteMatch = pathRemoteRegex.exec(line)?.groups?.remote;
    if (remoteMatch) {
      remote = upath.normalizeTrim(remoteMatch.trim());
      continue;
    }

    const specName = pathSpecRegex.exec(line)?.groups?.name;
    if (specName === gemName && remote === '.') {
      return true;
    }
  }
  return false;
}

/**
 * Returns the sibling `Gemfile.lock` if Bundler resolved this gemspec into it.
 * Bundler records a gemspec loaded from the lock file's own directory in a `PATH` section with `remote: .`.
 */
export async function findGemspecLockFile(
  gemspecFile: string,
  gemspecContent: string,
): Promise<GemspecLockFile | null> {
  const lockFile = getSiblingFileName(gemspecFile, 'Gemfile.lock');
  const lockFileContent = await readLocalFile(lockFile, 'utf8');
  if (!lockFileContent) {
    logger.debug(`gemspec: no sibling ${lockFile} for ${gemspecFile}`);
    return null;
  }

  const gemName = getGemName(gemspecFile, gemspecContent);
  if (!locksGemFromOwnDirectory(lockFileContent, gemName)) {
    logger.debug(
      `gemspec: ${lockFile} does not lock ${gemName} from its own directory - ignoring it for ${gemspecFile}`,
    );
    return null;
  }

  return { lockFile, lockFileContent };
}
