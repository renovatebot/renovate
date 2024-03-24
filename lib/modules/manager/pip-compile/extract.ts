import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { ensureLocalPath } from '../../../util/fs/util';
import { normalizeDepName } from '../../datasource/pypi/common';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
import { extractPackageFile as extractSetupPyFile } from '../pip_setup';
import type { ExtractConfig, PackageFile, PackageFileContent } from '../types';
import { extractHeaderCommand } from './common';
import type {
  DependencyBetweenFiles,
  PipCompileArgs,
  SupportedManagers,
} from './types';
import {
  generateMermaidGraph,
  inferCommandExecDir,
  sortPackageFiles,
} from './utils';

function matchManager(filename: string): SupportedManagers | 'unknown' {
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
  packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  logger.trace('pip-compile.extractPackageFile()');
  const manager = matchManager(packageFile);
  switch (manager) {
    case 'pip_setup':
      return extractSetupPyFile(content, packageFile, _config);
    case 'pip_requirements':
      return extractRequirementsFile(content);
    case 'unknown':
      logger.warn(
        { packageFile },
        `pip-compile: could not determine manager for source file`,
      );
      return null;
    default:
      logger.warn(
        { packageFile, manager },
        `pip-compile: support for manager is not yet implemented`,
      );
      return null;
  }
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  fileMatches: string[],
): Promise<PackageFile[] | null> {
  logger.trace('pip-compile.extractAllPackageFiles()');
  const lockFileArgs = new Map<string, PipCompileArgs>();
  const depsBetweenFiles: DependencyBetweenFiles[] = [];
  const packageFiles = new Map<string, PackageFile>();
  for (const fileMatch of fileMatches) {
    const fileContent = await readLocalFile(fileMatch, 'utf8');
    if (!fileContent) {
      logger.debug(`pip-compile: no content found for fileMatch ${fileMatch}`);
      continue;
    }
    let compileArgs: PipCompileArgs;
    let compileDir: string;
    try {
      compileArgs = extractHeaderCommand(fileContent, fileMatch);
      compileDir = inferCommandExecDir(fileMatch, compileArgs.outputFile);
    } catch (error) {
      logger.warn({ fileMatch }, `pip-compile: ${error.message}`);
      continue;
    }
    lockFileArgs.set(fileMatch, compileArgs);
    for (const constraint in compileArgs.constraintsFiles) {
      depsBetweenFiles.push({
        sourceFile: constraint,
        outputFile: fileMatch,
        type: 'constraint',
      });
    }
    const lockedDeps = extractRequirementsFile(fileContent)?.deps;
    if (!lockedDeps) {
      logger.debug(
        { fileMatch },
        'pip-compile: Failed to extract dependencies from lock file',
      );
      continue;
    }

    for (const relativeSourceFile of compileArgs.sourceFiles) {
      const packageFile = upath.normalizeTrim(
        upath.join(compileDir, relativeSourceFile),
      );
      try {
        ensureLocalPath(packageFile);
      } catch (error) {
        logger.warn(
          { fileMatch, packageFile },
          'pip-compile: Source file path outside of repository',
        );
        continue;
      }
      depsBetweenFiles.push({
        sourceFile: packageFile,
        outputFile: fileMatch,
        type: 'requirement',
      });
      if (fileMatches.includes(packageFile)) {
        // TODO(not7cd): do something about it
        logger.warn(
          { sourceFile: packageFile, lockFile: fileMatch },
          'pip-compile: lock file acts as source file for another lock file',
        );
        continue;
      }
      if (packageFiles.has(packageFile)) {
        logger.debug(
          `pip-compile: ${packageFile} used in multiple output files`,
        );
        packageFiles.get(packageFile)!.lockFiles!.push(fileMatch);
        continue;
      }
      const content = await readLocalFile(packageFile, 'utf8');
      if (!content) {
        logger.debug(`pip-compile: No content for source file ${packageFile}`);
        continue;
      }

      const packageFileContent = extractPackageFile(
        content,
        packageFile,
        config,
      );
      if (packageFileContent) {
        if (packageFileContent.managerData?.requirementsFiles) {
          for (const file of packageFileContent.managerData.requirementsFiles) {
            depsBetweenFiles.push({
              sourceFile: file,
              outputFile: packageFile,
              type: 'requirement',
            });
          }
        }
        if (packageFileContent.managerData?.constraintsFiles) {
          for (const file of packageFileContent.managerData.constraintsFiles) {
            depsBetweenFiles.push({
              sourceFile: file,
              outputFile: packageFile,
              type: 'requirement',
            });
          }
        }
        for (const dep of packageFileContent.deps) {
          const lockedVersion = lockedDeps?.find(
            (lockedDep) =>
              normalizeDepName(lockedDep.depName!) ===
              normalizeDepName(dep.depName!),
          )?.currentVersion;
          if (lockedVersion) {
            dep.lockedVersion = lockedVersion;
          } else {
            logger.warn(
              { depName: dep.depName, lockFile: fileMatch },
              'pip-compile: dependency not found in lock file',
            );
          }
        }
        packageFiles.set(packageFile, {
          ...packageFileContent,
          lockFiles: [fileMatch],
          packageFile,
        });
      } else {
        logger.warn(
          { packageFile },
          'pip-compile: failed to find dependencies in source file',
        );
      }
    }
  }
  if (packageFiles.size === 0) {
    return null;
  }
  const result: PackageFile[] = sortPackageFiles(
    depsBetweenFiles,
    packageFiles,
  );
  logger.debug(
    'pip-compile: dependency graph:\n' +
      generateMermaidGraph(depsBetweenFiles, lockFileArgs),
  );
  return result;
}
