import { quote } from 'shlex';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';

export async function updatePackage(
  filePath: string,
  packageName?: string,
  group?: string,
): Promise<void> {
  const execOptions: ExecOptions = {
    cwdFile: filePath,
  };
  const groupFilter = group ? ` --group ${quote(group)}` : '';
  const packageFilter = packageName ? `${quote(packageName)}` : '';
  await exec(`paket update${groupFilter} ${packageFilter}`, execOptions);
}

export async function updateAllPackages(
  filePath: string,
  group?: string,
): Promise<void> {
  await updatePackage(filePath, undefined, group);
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
    .split('\n')
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
