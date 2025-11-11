import type { GlobalPreset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, GlobalPreset> = {
  allowAllUnsafe: {
    allowCustomCrateRegistries: true,
    allowedCommands: ['/.*/'],
    allowedEnv: ['/.*/'],
    allowedHeaders: ['/.*/'],
    allowPlugins: true,
    allowScripts: true,
    description:
      'Set all `allow*` and `allowed*` settings to true. Administrators should think carefully before enabling this for their self-hosted usages, as it will introduce all possible avenues for remote code execution from packages and repo owners alike.',
  },
  safeEnv: {
    allowedEnv: ['GO*', 'GRADLE_OPTS', 'RUSTC_BOOTSTRAP'],
    description:
      'Hopefully safe environment variables to allow users to configure.',
  },
};
