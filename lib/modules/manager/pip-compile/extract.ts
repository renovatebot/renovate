import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
import { extractPackageFile as extractSetupPyFile } from '../pip_setup';
import { extractPackageFile as extractSetupCfgFile } from '../setup-cfg';
import type { ExtractConfig, PackageFile, PackageFileContent } from '../types';
import { extractHeaderCommand } from './common';

function matchManager(filename: string): string {
  if (filename.endsWith('setup.py')) {
    return 'pip_setup';
  }
  if (filename.endsWith('setup.cfg')) {
    return 'setup-cfg';
  }
  if (filename.endsWith('pyproject.toml')) {
    return 'pep621';
  }
  // naive, could be improved, maybe use pip_requirements.fileMatch
  if (filename.endsWith('.in')) {
    return 'pip_requirements';
  }
  return 'unknown';
}

export async function extractPackageFile(
  content: string,
  _packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace('pip-compile.extractPackageFile()');
  const manager = matchManager(_packageFile);
  // TODO(not7cd): extract based on manager: pep621, identify other missing source types
  switch (manager) {
    case 'pip_setup':
      return extractSetupPyFile(content, _packageFile, _config);
    case 'setup-cfg':
      return await extractSetupCfgFile(content);
    case 'pip_requirements':
      return extractRequirementsFile(content);
    default:
      logger.error(`Unsupported manager ${manager} for ${_packageFile}`);
      return null;
  }
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  logger.trace('pip-compile.extractAllPackageFiles()');
  const result: PackageFile[] = [];
  for (const lockFile of packageFiles) {
    const content = await readLocalFile(lockFile, 'utf8');
    // istanbul ignore else
    if (content) {
      const pipCompileArgs = extractHeaderCommand(content, lockFile);
      // TODO(not7cd): handle locked deps
      // const lockedDeps = extractRequirementsFile(content);
      for (const sourceFile of pipCompileArgs.sourceFiles) {
        const content = await readLocalFile(sourceFile, 'utf8');
        if (content) {
          const deps = await extractPackageFile(content, sourceFile, config);
          if (deps) {
            result.push({
              ...deps,
              lockFiles: [lockFile],
              packageFile: sourceFile,
            });
          } else {
            logger.error(
              { packageFile: sourceFile },
              'Failed to extract dependencies',
            );
          }
        } else {
          logger.debug({ packageFile: sourceFile }, 'No content found');
        }
      }
    } else {
      logger.debug({ packageFile: lockFile }, 'No content found');
    }
  }
  // TODO(not7cd): sort by requirement layering (-r -c within .in files)
  return result;
}
