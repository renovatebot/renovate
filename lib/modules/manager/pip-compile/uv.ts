// eslint-disable-next-line renovate/prefer-fs-util -- The helpers do not support mkdtemp or setting permissions when creating a file. All paths below are scoped to privateCacheDir.
import fs from 'fs-extra';
import upath from 'upath';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { ensureDir, privateCacheDir } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { findPypiIndexCredentials } from '../../datasource/pypi/host-rules.ts';

function quoteNetrc(value: string): string {
  return `"${value.replace(regEx(/["\\]/g), '\\$&')}"`;
}

export async function execUv(
  cmd: string,
  options: ExecOptions,
  registryUrls: URL[],
): Promise<void> {
  const entries = new Map<string, string>();
  for (const url of registryUrls) {
    const { username, password } = await findPypiIndexCredentials(url.href);
    if (username || password) {
      entries.set(
        url.hostname,
        `machine ${quoteNetrc(url.hostname)} login ${quoteNetrc(username ?? '')} password ${quoteNetrc(password ?? '')}`,
      );
    }
  }

  if (!entries.size) {
    await exec(cmd, options);
    return;
  }

  // Index URL environment variables can be overridden by command-line flags,
  // and uv can persist their credentials when --emit-index-url is enabled.
  // The private cache is also mounted in Docker and cleared between repositories.
  const cacheDir = privateCacheDir();
  await ensureDir(cacheDir);
  const credentialsDir = await fs.mkdtemp(upath.join(cacheDir, 'uv-'));
  try {
    const netrc = upath.join(credentialsDir, '.netrc');
    await fs.writeFile(netrc, `${[...entries.values()].join('\n')}\n`, {
      mode: 0o600,
    });
    await exec(cmd, {
      ...options,
      extraEnv: { ...options.extraEnv, NETRC: netrc },
    });
  } finally {
    await fs.remove(credentialsDir);
  }
}
