import { quote } from 'shlex';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';

export interface UpdatePackage {
  filePath: string;
  packageName?: string;
  group?: string;
  version?: string;
}

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

export async function updateAllPackages(
  filePath: string,
  group?: string,
): Promise<void> {
  await updatePackage({ filePath, group });
}
