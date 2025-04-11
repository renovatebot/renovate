import readline from 'node:readline';
import type { AllConfig } from '../../../../config/types';
import { getEnv } from '../../../../util/env';

/* v8 ignore start */
export async function setConfig(config: AllConfig): Promise<AllConfig> {
  const env = getEnv();
  if (env.CODESPACES !== 'true') {
    return config;
  }

  if (!config.token && env.GITHUB_TOKEN) {
    config.token = env.GITHUB_TOKEN;
  }

  if (!config.repositories?.length) {
    const rl = readline.promises.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const repo = await rl.question('\n\nRepository name: ');
    config.repositories = [repo];
  }

  return config;
}
/* v8 ignore stop */
