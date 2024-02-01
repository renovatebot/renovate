import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
// TODO(not7cd): enable in the next PR, when this can be properly tested
// import { extractPackageFile as extractSetupPyFile } from '../pip_setup';
// import { extractPackageFile as extractSetupCfgFile } from '../setup-cfg';
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

export function extractPackageFile(
  content: string,
  _packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  logger.trace('pip-compile.extractPackageFile()');
  const manager = matchManager(_packageFile);
  // TODO(not7cd): extract based on manager: pep621, setupdools, identify other missing source types
  switch (manager) {
    // TODO(not7cd): enable in the next PR, when this can be properly tested
    // case 'pip_setup':
    //   return extractSetupPyFile(content, _packageFile, _config);
    // case 'setup-cfg':
    //   return await extractSetupCfgFile(content);
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
  const result = new Map<string, PackageFile>();
  for (const lockFile of packageFiles) {
    const lockFileContent = await readLocalFile(lockFile, 'utf8');
    // istanbul ignore else
    if (lockFileContent) {
      try {
        const pipCompileArgs = extractHeaderCommand(lockFileContent, lockFile);
        // TODO(not7cd): handle locked deps
        // const lockedDeps = extractRequirementsFile(content);
        for (const sourceFile of pipCompileArgs.sourceFiles) {
          if (result.has(sourceFile)) {
            result.get(sourceFile)?.lockFiles?.push(lockFile);
            continue;
          }
          const content = await readLocalFile(sourceFile, 'utf8');
          if (content) {
            const deps = extractPackageFile(content, sourceFile, config);
            if (deps) {
              result.set(sourceFile, {
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
      } catch (error) {
        logger.warn(error, 'Failed to parse pip-compile command from header');
        continue;
      }
    } else {
      logger.debug({ packageFile: lockFile }, 'No content found');
    }
  }
  // TODO(not7cd): sort by requirement layering (-r -c within .in files)
  return Array.from(result.values());
}
