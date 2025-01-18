import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  safeEnv: {
    allowedEnv: ['GO*', 'RUSTC_BOOTSTRAP'],
    description:
      'Hopefully safe environment variables to allow users to configure.',
  },
};
