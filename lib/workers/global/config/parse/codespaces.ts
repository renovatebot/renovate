import readline from 'node:readline';
import type { AllConfig } from '../../../../config/types';
import { getEnv } from '../../../../util/env';

export async function setConfig(config: AllConfig): Promise<AllConfig> {
  const env = getEnv();
  // eslint-disable-next-line
  console.log('env', env);
  if (env.CODESPACES !== 'true') {
    return config;
  }

  if (!config.token && env.GITHUB_TOKEN) {
    config.token = env.GITHUB_TOKEN;
  }

  // istanbul ignore if
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
