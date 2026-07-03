import { quote } from 'shlex';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types.ts';
import type { UpdatePackage } from './types.ts';

function buildUpdateCommand(command: UpdatePackage): string {
  const groupFilter = command.group ? ` --group ${quote(command.group)} ` : '';
  const packageFilter = command.packageName
    ? ` ${quote(command.packageName)} `
    : '';
  const version = command.version
    ? ` --version ${quote(command.version)} `
    : '';
  return `paket update${groupFilter}${version}${packageFilter}`;
}

/**
 * Call the paket cli to update dependencies by refreshing the lock file.
 * All commands run in a single exec call to avoid spinning up the tool environment once per dependency.
 * The packages will be downloaded (normally not committed on git), and the lock file will be updated.
 * Other versioned files are not affected.
 * https://fsprojects.github.io/Paket/paket-update.html
 *
 * @param filePath - path of the lock file, used as working directory
 * @param commands - parameters of each paket update call
 * @param toolConstraints - version constraints of the tools to install
 */
export async function runPaketUpdate(
  filePath: string,
  commands: UpdatePackage[],
  toolConstraints?: ToolConstraint[],
): Promise<void> {
  const execOptions: ExecOptions = {
    cwdFile: filePath,
    docker: {},
    toolConstraints,
  };
  await exec(commands.map(buildUpdateCommand), execOptions);
}
