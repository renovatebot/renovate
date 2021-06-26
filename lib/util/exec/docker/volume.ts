import { rawExec } from '../common';

export async function volumeCreate(
  name: string,
  meta?: Record<string, string>
): Promise<void> {
  const cmdParts = ['docker', 'volume', 'create'];

  if (meta) {
    const kvPairs = Object.entries(meta);
    const labelOptions = kvPairs.map(([k, v]) => `--label ${k}=${v}`);
    cmdParts.push(...labelOptions);
  }

  cmdParts.push(name);

  const cmd = cmdParts.join(' ');
  await rawExec(cmd, { encoding: 'utf-8' });
}

export async function volumePrune(
  meta?: Record<string, string>
): Promise<void> {
  const cmdParts = ['docker', 'volume', 'prune', '--force'];

  const kvPairs = Object.entries(meta);
  const filterOptions = kvPairs.map(([k, v]) => `--filter label=${k}=${v}`);
  cmdParts.push(...filterOptions);

  const cmd = cmdParts.join(' ');
  await rawExec(cmd, { encoding: 'utf-8' });
}
