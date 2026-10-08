import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { runBundlerLock } from '../bundler/lock.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

const gemspecDirectiveRegex = regEx(/^\s*gemspec\b(?<args>.*)$/);
const nameOptionRegex = regEx(
  /(?:\bname:|:name\s*=>)\s*['"](?<value>[^'"]+)['"]/,
);
const pathOptionRegex = regEx(
  /(?:\bpath:|:path\s*=>)\s*['"](?<value>[^'"]+)['"]/,
);

// Bundler loads `<path>/<name>.gemspec`, defaulting to `.` and `*`
function loadsGemspec(gemfileContent: string, gemspecFile: string): boolean {
  const gemName = upath.basename(gemspecFile, '.gemspec');
  return gemfileContent.split(newlineRegex).some((line) => {
    const args = gemspecDirectiveRegex.exec(line)?.groups?.args;
    if (args === undefined) {
      return false;
    }
    const name = nameOptionRegex.exec(args)?.groups?.value;
    const path = pathOptionRegex.exec(args)?.groups?.value ?? '.';
    return (!name || name === gemName) && upath.normalizeTrim(path) === '.';
  });
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName } = updateArtifact;
  const lockFileName = getSiblingFileName(packageFileName, 'Gemfile.lock');
  if (!(await localPathExists(lockFileName))) {
    logger.debug(
      `gemspec: no sibling ${lockFileName} for ${packageFileName} - skipping lock refresh`,
    );
    return null;
  }

  const gemfileName = getSiblingFileName(packageFileName, 'Gemfile');
  const gemfileContent = await readLocalFile(gemfileName, 'utf8');
  if (!gemfileContent) {
    logger.debug(
      `gemspec: no sibling ${gemfileName} for ${packageFileName} - skipping lock refresh`,
    );
    return null;
  }
  if (!loadsGemspec(gemfileContent, packageFileName)) {
    logger.debug(
      `gemspec: ${gemfileName} does not load ${packageFileName} via the gemspec directive - skipping lock refresh`,
    );
    return null;
  }

  return runBundlerLock(updateArtifact, lockFileName);
}
