import upath from 'upath';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { readLocalFile } from '../../../util/fs';
import { ensureLocalPath } from '../../../util/fs/util';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
import { extractPackageFile as extractSetupPyFile } from '../pip_setup';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import { extractHeaderCommand, matchManager } from './common';
import type { DependencyBetweenFiles, PipCompileArgs } from './types';
import {
  generateMermaidGraph,
  inferCommandExecDir,
  sortPackageFiles,
} from './utils';

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
  const lockFileSources = new Map<string, PackageFile[]>();
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
      logger.warn(
        { fileMatch, errorMessage: error.message },
        'pip-compile error',
      );
      continue;
    }
    lockFileArgs.set(fileMatch, compileArgs);
    for (const constraint of coerceArray(compileArgs.constraintsFiles)) {
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
      } catch {
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
        const existingPackageFile = packageFiles.get(packageFile)!;
        existingPackageFile.lockFiles!.push(fileMatch);
        extendWithIndirectDeps(existingPackageFile, lockedDeps);
        const source = lockFileSources.get(fileMatch) ?? [];
        source.push(existingPackageFile);
        lockFileSources.set(fileMatch, source);
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
          packageFileContent.managerData.requirementsFiles =
            packageFileContent.managerData.requirementsFiles.map(
              (file: string) => upath.normalize(upath.join(compileDir, file)),
            );
          for (const file of packageFileContent.managerData.requirementsFiles) {
            depsBetweenFiles.push({
              sourceFile: file,
              outputFile: packageFile,
              type: 'requirement',
            });
          }
        }
        if (packageFileContent.managerData?.constraintsFiles) {
          packageFileContent.managerData.constraintsFiles =
            packageFileContent.managerData.constraintsFiles.map(
              (file: string) => upath.normalize(upath.join(compileDir, file)),
            );
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
            (lockedDep) => lockedDep.packageName! === dep.packageName!,
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
        extendWithIndirectDeps(packageFileContent, lockedDeps);
        const newPackageFile: PackageFile = {
          ...packageFileContent,
          lockFiles: [fileMatch],
          packageFile,
        };
        packageFiles.set(packageFile, newPackageFile);
        const source = lockFileSources.get(fileMatch) ?? [];
        source.push(newPackageFile);
        lockFileSources.set(fileMatch, source);
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

  // This needs to go in reverse order to handle transitive dependencies
  for (const packageFile of [...result].reverse()) {
    for (const reqFile of packageFile.managerData?.requirementsFiles ?? []) {
      let sourceFiles: PackageFile[] | undefined = undefined;
      if (fileMatches.includes(reqFile)) {
        sourceFiles = lockFileSources.get(reqFile);
      } else if (packageFiles.has(reqFile)) {
        sourceFiles = [packageFiles.get(reqFile)!];
      }
      if (!sourceFiles) {
        logger.warn(
          { packageFile: packageFile.packageFile, requirementsFile: reqFile },
          'pip-compile: Package file references a file which does not appear to be a requirements file managed by pip-compile',
        );
        continue;
      }
      // These get reversed before merging so that we keep the last instance of any common
      // lock files, since a file that -r includes multiple lock files needs to be updated after
      // all of the lock files it includes
      const files = new Set([...packageFile.lockFiles!].reverse());
      for (const sourceFile of sourceFiles) {
        const merged = new Set(files);
        for (const lockFile of [...sourceFile.lockFiles!].reverse()) {
          merged.add(lockFile);
        }
        sourceFile.lockFiles = Array.from(merged).reverse();
      }
    }
  }
  logger.debug(
    'pip-compile: dependency graph:\n' +
      generateMermaidGraph(depsBetweenFiles, lockFileArgs),
  );
  return result;
}

function extendWithIndirectDeps(
  packageFileContent: PackageFileContent,
  lockedDeps: PackageDependency[],
): void {
  for (const lockedDep of lockedDeps) {
    if (
      !packageFileContent.deps.find(
        (dep) => lockedDep.packageName! === dep.packageName!,
      )
    ) {
      packageFileContent.deps.push(indirectDep(lockedDep));
    }
  }
}

/**
 * As indirect dependecies don't exist in the package file, we need to
 * create them from the lock file.
 *
 * By removing currentValue and currentVersion, we ensure that they
 * are handled like unconstrained dependencies with locked version.
 * Such packages are updated when their update strategy
 * is set to 'update-lockfile',
 * see: lib/workers/repository/process/lookup/index.ts.
 *
 * By disabling them by default, we won't create noise by updating them.
 * Unless they have vulnerability alert, then they are forced to be updated.
 * @param dep dependency extracted from lock file (requirements.txt)
 * @returns unconstrained dependency with locked version
 */
function indirectDep(dep: PackageDependency): PackageDependency {
  const result = {
    ...dep,
    lockedVersion: dep.currentVersion,
    depType: 'indirect',
    enabled: false,
  };
  delete result.currentValue;
  delete result.currentVersion;
  return result;
}
