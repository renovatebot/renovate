import os from 'node:os';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
import type { ToolConstraint } from '../../util/exec/types.ts';
import {
  chmodLocalFile,
  readLocalFile,
  statLocalFile,
} from '../../util/fs/index.ts';
import type { StatusResult } from '../../util/git/types.ts';
import type { UpdateArtifactsConfig, UpdateArtifactsResult } from './types.ts';

/**
 * Pick the wrapper script name to invoke on the current platform.
 * @param posixName wrapper name used everywhere but on native Windows
 * @param windowsName wrapper name used on native Windows
 */
export function wrapperFileName(
  posixName: string,
  windowsName: string,
): string {
  if (
    os.platform() === 'win32' &&
    GlobalConfig.get('binarySource') !== 'docker'
  ) {
    return windowsName;
  }
  return posixName;
}

/**
 * Make sure the wrapper script exists and is executable, then build the
 * command which runs it.
 * @param wrapperFilePath path of the wrapper script, relative to the repo root
 * @param wrapperName wrapper name to invoke, see {@link wrapperFileName}
 * @param args arguments to append to the wrapper invocation
 * @returns the command to execute, or `null` if there is no wrapper script
 */
export async function prepareWrapperCommand(
  wrapperFilePath: string,
  wrapperName: string,
  args?: string,
): Promise<string | null> {
  const wrapperStat = await statLocalFile(wrapperFilePath);
  if (wrapperStat?.isFile() !== true) {
    return null;
  }

  // if the file is not executable by others
  if (os.platform() !== 'win32' && (wrapperStat.mode & 0o1) === 0) {
    logger.debug(`Wrapper ${wrapperFilePath} is missing the executable bit`);
    // add the execution permission to the owner, group and others
    await chmodLocalFile(wrapperFilePath, wrapperStat.mode | 0o111);
  }

  return args ? `${wrapperName} ${args}` : wrapperName;
}

/**
 * Build the `java` tool constraint, preferring the user configured one.
 * @param config artifacts update config
 * @param fallbackConstraint constraint derived from the package file
 */
export function javaToolConstraint(
  config: UpdateArtifactsConfig,
  fallbackConstraint: string | null,
): ToolConstraint {
  return {
    toolName: 'java',
    constraint: config.constraints?.java ?? fallbackConstraint,
  };
}

/**
 * Return an update result for each of the given files which git reports as
 * modified, keeping the given order.
 */
export async function collectModifiedFiles(
  status: StatusResult,
  fileProjectPaths: string[],
): Promise<UpdateArtifactsResult[]> {
  const results: UpdateArtifactsResult[] = [];
  for (const fileProjectPath of fileProjectPaths) {
    if (!status.modified.includes(fileProjectPath)) {
      continue;
    }

    results.push({
      file: {
        type: 'addition',
        path: fileProjectPath,
        contents: await readLocalFile(fileProjectPath),
      },
    });
  }
  return results;
}
