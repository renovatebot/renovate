import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { constructPipCompileCmd } from './artifacts';
import { getExecOptions } from './common';

export async function updateLockedDependency(
  config: UpdateLockedConfig,
): Promise<UpdateLockedResult> {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `pip-compile.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    const lockedDeps = extractRequirementsFile(lockFileContent ?? '')?.deps;
    if (!lockedDeps) {
      throw new Error(`failed to extract dependencies from ${lockFile}`);
    }
    for (const lockedDep of lockedDeps) {
      if (
        lockedDep.depName === depName &&
        lockedDep.currentVersion === newVersion
      ) {
        return { status: 'already-updated' };
      }
    }
    const cmd =
      constructPipCompileCmd(lockFileContent ?? '', lockFile) +
      ` --upgrade-package=${depName}==${newVersion}`;
    const execOptions: ExecOptions = await getExecOptions(config, lockFile);
    logger.trace({ cmd }, 'pip-compile command');
    await exec(cmd, execOptions);
    const status = await getRepoStatus();
    if (!status?.modified.includes(lockFile)) {
      throw new Error(`command failed to update ${lockFile}`);
    }
    // const newLockFileContent = extractRequirementsFile(lockFileContent ?? '')!;
    const newLockFileContent = await readLocalFile(lockFile, 'utf8');
    if (!newLockFileContent) {
      throw new Error(`failed to read ${lockFile} after update`);
    }
    return { status: 'updated', files: { [lockFile]: newLockFileContent } };
  } catch (err) {
    logger.debug({ err }, 'pip-compile.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
