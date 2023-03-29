import readline from 'node:readline';
import type { AllConfig } from '../../../../config/types';

// istanbul ignore next
export async function setConfig(config: AllConfig): Promise<AllConfig> {
  if (process.env.CODESPACES !== 'true') {
    return config;
  }

  if (!config.token && process.env.GITHUB_TOKEN) {
    config.token = process.env.GITHUB_TOKEN;
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
