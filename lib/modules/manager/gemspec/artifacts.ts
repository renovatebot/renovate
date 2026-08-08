import { logger } from '../../../logger/index.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { runBundlerLock } from '../bundler/lock.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

const gemspecDirectiveRegex = regEx(/^\s*gemspec\b/);

function hasGemspecDirective(gemfileContent: string): boolean {
  return gemfileContent
    .split(newlineRegex)
    .some((line) => gemspecDirectiveRegex.test(line));
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
  if (!hasGemspecDirective(gemfileContent)) {
    logger.debug(
      `gemspec: ${gemfileName} does not use the gemspec directive - skipping lock refresh for ${packageFileName}`,
    );
    return null;
  }

  return runBundlerLock(updateArtifact, lockFileName);
}
