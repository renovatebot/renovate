import upath from 'upath';
import { logger } from '../../../logger';
import { isValidLocalPath, readLocalFile } from '../../../util/fs';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
// TODO(not7cd): enable in the next PR, when this can be properly tested
// import { extractPackageFile as extractSetupPyFile } from '../pip_setup';
// import { extractPackageFile as extractSetupCfgFile } from '../setup-cfg';
import type { ExtractConfig, PackageFile, PackageFileContent } from '../types';
import { extractHeaderCommand, generateMermaidGraph } from './common';
import type {
  DependencyBetweenFiles,
  PipCompileArgs,
  SupportedManagers,
} from './types';

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
  // TODO(not7cd): extract based on manager: pep621, setuptools, identify other missing source types
  switch (manager) {
    // TODO(not7cd): enable in the next PR, when this can be properly tested
    // case 'pip_setup':
    //   return extractSetupPyFile(content, _packageFile, _config);
    // case 'setup-cfg':
    //   return await extractSetupCfgFile(content);
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
  // for debugging only ^^^ (for now)
  const packageFiles = new Map<string, PackageFile>();
  for (const fileMatch of fileMatches) {
    const fileContent = await readLocalFile(fileMatch, 'utf8');
    if (!fileContent) {
      logger.debug(`pip-compile: no content found for fileMatch ${fileMatch}`);
      continue;
    }
    // TODO(not7cd): rename to headerArguments
    let pipCompileArgs: PipCompileArgs;
    try {
      pipCompileArgs = extractHeaderCommand(fileContent, fileMatch);
    } catch (error) {
      console.log('error', error);
      logger.warn(
        { fileMatch, error },
        'pip-compile: Failed to extract and parse command in output file header',
      );
      continue;
    }
    const compileDir: string = pipCompileArgs.commandExecDir;
    console.log(compileDir, 'compileDir', fileMatch, 'fileMatch');
    // if (compileDir !== '.' && !isValidLocalPath(compileDir)) {
    //   logger.warn(
    //     { fileMatch, compileDir },
    //     'pip-compile: Output file path outside of repository',
    //   );
    //   continue;
    // }
    lockFileArgs.set(fileMatch, pipCompileArgs);
    for (const constraint in pipCompileArgs.constraintsFiles) {
      // TODO(not7cd): handle constraints
      /* istanbul ignore next */
      depsBetweenFiles.push({
        sourceFile: constraint,
        outputFile: fileMatch,
        type: 'constraint',
      });
    }
    // TODO(not7cd): handle locked deps
    // const lockedDeps = extractRequirementsFile(content);
    for (const relativeSourceFile of pipCompileArgs.sourceFiles) {
      const packageFile = upath.normalizeTrim(
        upath.join(compileDir, relativeSourceFile),
      );
      // Unable to check for that. Let it error out
      // if (!isValidLocalPath(packageFile)) {
      //   console.log('NOT VALID packageFile', packageFile);
      //   logger.warn(
      //     { fileMatch, packageFile },
      //     'pip-compile: Source file path outside of repository',
      //   );
      //   continue;
      // }
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
  // TODO(not7cd): sort by requirement layering (-r -c within .in files)
  if (packageFiles.size === 0) {
    return null;
  }
  logger.debug(
    'pip-compile: dependency graph:\n' +
      generateMermaidGraph(depsBetweenFiles, lockFileArgs),
  );
  return Array.from(packageFiles.values());
}
