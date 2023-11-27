import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { ensureCacheDir, readLocalFile } from '../../../util/fs';
import { escapeRegExp, regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { extrasPattern } from './extract';

/**
 * Create a RegExp that matches the first dependency pattern for
 * the named dependency that is followed by package hashes.
 *
 * The regular expression defines a single named group `depConstraint`
 * that holds the dependency constraint without the hash specifiers.
 * The substring matched by this named group will start with the dependency
 * name and end with a non-whitespace character.
 *
 * @param depName the name of the dependency
 */
function dependencyAndHashPattern(depName: string): RegExp {
  const escapedDepName = escapeRegExp(depName);

  // extrasPattern covers any whitespace between the dep name and the optional extras specifier,
  // but it does not cover any whitespace in front of the equal signs.
  //
  // Use a non-greedy wildcard for the range pattern; otherwise, we would
  // include all but the last hash specifier into depConstraint.
  return regEx(
    `^\\s*(?<depConstraint>${escapedDepName}${extrasPattern}\\s*==.*?\\S)\\s+--hash=`,
    'm',
  );
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pip_requirements.updateArtifacts(${packageFileName})`);
  if (!is.nonEmptyArray(updatedDeps)) {
    logger.debug('No updated pip_requirements deps - returning null');
    return null;
  }
  try {
    const cmd: string[] = [];
    const rewrittenContent = newPackageFileContent.replace(regEx(/\\\n/g), '');
    for (const dep of updatedDeps) {
      if (!dep.depName) {
        continue;
      }
      const depAndHashMatch = dependencyAndHashPattern(dep.depName).exec(
        rewrittenContent,
      );
      if (depAndHashMatch) {
        // If there's a match, then the regular expression guarantees
        // that the named subgroup deepConstraint did match as well.
        const depConstraint = depAndHashMatch.groups!.depConstraint;
        cmd.push(`hashin ${quote(depConstraint)} -r ${quote(packageFileName)}`);
      }
    }
    if (!cmd.length) {
      logger.debug('No hashin commands to run - returning');
      return null;
    }
    const execOptions: ExecOptions = {
      cwdFile: '.',
      docker: {},
      toolConstraints: [
        { toolName: 'python', constraint: config.constraints?.python },
        { toolName: 'hashin' },
      ],
      extraEnv: {
        PIP_CACHE_DIR: await ensureCacheDir('pip'),
      },
    };
    await exec(cmd, execOptions);
    const newContent = await readLocalFile(packageFileName, 'utf8');
    if (newContent === newPackageFileContent) {
      logger.debug(`${packageFileName} is unchanged`);
      return null;
    }
    logger.debug(`Returning updated ${packageFileName}`);
    return [
      {
        file: {
          type: 'addition',
          path: packageFileName,
          contents: newContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${packageFileName} file`);
    return [
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
        },
      },
    ];
  }
}
