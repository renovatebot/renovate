import { quote } from 'shlex';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { newlineRegex } from '../../../util/regex';

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

export async function getAllPackages(
  filePath: string,
): Promise<{ name: string; version: string; group: string }[]> {
  const execOptions: ExecOptions = {
    cwdFile: filePath,
  };
  const result = await exec(
    `paket show-installed-packages --silent`,
    execOptions,
  );
  return result.stdout
    .split(newlineRegex)
    .map((line) => line.split(' - '))
    .filter((line) => line.length === 2)
    .map((line) => {
      const [group, name] = line[0].trim().split(' ');
      return {
        group,
        name,
        version: line[1].trim(),
      };
    });
}
