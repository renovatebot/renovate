import { quote } from 'shlex';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import type { UpdatePackage } from './types.ts';

/**
 * Call the paket cli to update dependencies by refreshing the lock file.
 * The packages will be downloaded (normally not committed on git), and the lock file will be updated.
 * Other versioned files are not affected.
 * https://fsprojects.github.io/Paket/paket-update.html
 *
 * @param command - parameters of paket cli
 */
export async function runPaketUpdate(command: UpdatePackage): Promise<void> {
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
