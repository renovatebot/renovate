import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
import { extractPackageFile as extractSetupPyFile } from '../pip_setup';
import { extractPackageFile as extractSetupCfgFile } from '../setup-cfg';
import type { ExtractConfig, PackageFile } from '../types';
import { extractHeaderCommand } from './common';

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  const result: PackageFile[] = [];
  for (const lockFile of packageFiles) {
    logger.debug({ packageFile: lockFile }, 'READING FILE');
    const content = await readLocalFile(lockFile, 'utf8');
    // istanbul ignore else
    if (content) {
      const pipCompileArgs = extractHeaderCommand(content, lockFile);
      // TODO(not7cd): handle locked deps
      // const lockedDeps = extractRequirementsFile(content);
      for (const sourceFile of pipCompileArgs.sourceFiles) {
        const content = await readLocalFile(sourceFile, 'utf8');
        if (content) {
          if (sourceFile.endsWith('.in')) {
            const deps = extractRequirementsFile(content);
            if (deps) {
              result.push({
                ...deps,
                lockFiles: [lockFile],
                packageFile: sourceFile,
              });
            }
          } else if (sourceFile.endsWith('.py')) {
            const deps = extractSetupPyFile(content, sourceFile, config);
            if (deps) {
              result.push({
                ...deps,
                lockFiles: [lockFile],
                packageFile: sourceFile,
              });
            }
          } else if (sourceFile.endsWith('.cfg')) {
            const deps = await extractSetupCfgFile(content);
            if (deps) {
              result.push({
                ...deps,
                lockFiles: [lockFile],
                packageFile: sourceFile,
              });
            }
          } else {
            // TODO(not7cd): extract based on manager: pep621, etc.
            logger.debug({ packageFile: sourceFile }, 'Not supported');
          }
        } else {
          logger.debug({ packageFile: sourceFile }, 'No content found');
        }
      }
    } else {
      logger.debug({ packageFile: lockFile }, 'No content found');
    }
  }
  return result;
}
