import { quote } from 'shlex';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import type { UpdatePackage } from './types.ts';

/**
 * Call the paket cli to update dependencies by refreshing the lock file.
 * https://fsprojects.github.io/Paket/paket-update.html
 *
 * @param command - parameters of paket cli
 */
export async function updatePackage(command: UpdatePackage): Promise<void> {
  const execOptions: ExecOptions = {
    cwdFile: command.filePath,
  };
  const groupFilter = command.group ? ` --group ${quote(command.group)} ` : '';
  const packageFilter = command.packageName
    ? ` ${quote(command.packageName)} `
    : '';
  const version = command.version
    ? ` --version ${quote(command.version)} `
    : '';
  await exec(
    `paket update${groupFilter}${version}${packageFilter}`,
    execOptions,
  );
}

/**
 * Call the paket cli to update dependencies by refreshing the lock file.
 * https://fsprojects.github.io/Paket/paket-update.html
 *
 * @param filePath - The path to Paket dependencies file. Allows you to know the directory where to execute the paket command.
 * @param group - The dependency group name. If not specified, then it updates all groups.
 */
export async function updateAllPackages(
  filePath: string,
  group?: string,
): Promise<void> {
  await updatePackage({ filePath, group });
}
