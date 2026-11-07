import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types.ts';
import { findPypiIndexCredentials } from '../../datasource/pypi/host-rules.ts';

export async function execPipCompile(
  cmd: string,
  options: ExecOptions,
  registryUrls: URL[],
): Promise<void> {
  const registryCredVars: ExtraEnv<string> = {};
  for (const [index, url] of registryUrls.entries()) {
    const { username, password } = await findPypiIndexCredentials(url.href);
    if (username || password) {
      registryCredVars[`KEYRING_SERVICE_NAME_${index}`] = url.hostname;
      registryCredVars[`KEYRING_SERVICE_USERNAME_${index}`] = username ?? '';
      registryCredVars[`KEYRING_SERVICE_PASSWORD_${index}`] = password ?? '';
    }
  }

  // Only log variable names: the values are registry credentials.
  logger.trace(
    { registryCredVars: Object.keys(registryCredVars) },
    'pip-compile registry credentials',
  );
  await exec(cmd, {
    ...options,
    extraEnv: { ...options.extraEnv, ...registryCredVars },
  });
}
