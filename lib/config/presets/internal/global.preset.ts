import type { GlobalPreset } from '../types.ts';

export const presets: Record<string, GlobalPreset> = {
  safeEnv: {
    allowedEnv: [
      'BUN_CONFIG_MAX_HTTP_REQUESTS',
      'GO*',
      'GRADLE_OPTS',
      'RUSTC_BOOTSTRAP',
      'PNPM_WORKERS',
      'PNPM_MAX_WORKERS',
      'PNPM_CONFIG_TRUST_LOCKFILE',
    ],
    description:
      'Hopefully safe environment variables to allow users to configure.',
  },
};
