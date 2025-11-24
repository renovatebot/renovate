import type { GlobalPreset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, GlobalPreset> = {
  safeEnv: {
    allowedEnv: ['GO*', 'GRADLE_OPTS', 'RUSTC_BOOTSTRAP'],
    description:
      'Hopefully safe environment variables to allow users to configure.',
  },
};
