import { resolve } from 'node:path';
import { execaNode } from 'execa';
import type { AllConfig } from '../../../../lib/config/types.ts';
import {
  GERRIT_ADMIN_PASSWORD,
  GERRIT_ADMIN_USERNAME,
  getBaseUrl,
} from './gerrit-container.ts';

const renovateEntrypoint = resolve(
  import.meta.dirname,
  '../../../../lib/renovate.ts',
);

export async function renovate(
  repositories: string[],
  overrides: AllConfig = {},
): Promise<void> {
  const config: AllConfig = {
    platform: 'gerrit',
    endpoint: `${getBaseUrl()}/`,
    username: GERRIT_ADMIN_USERNAME,
    password: GERRIT_ADMIN_PASSWORD,
    gitAuthor: 'Renovate Bot <renovate@renovateapp.com>',
    repositories,
    ...overrides,
  };

  await execaNode(renovateEntrypoint, {
    env: {
      RENOVATE_CONFIG: JSON.stringify(config),
      LOG_LEVEL: 'warn',
    },
    timeout: 120_000,
  });
}
