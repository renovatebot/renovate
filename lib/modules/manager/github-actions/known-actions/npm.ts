import { NpmDatasource } from '../../../datasource/npm/index.ts';
import * as npmVersioning from '../../../versioning/npm/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

export const npmActions: Record<string, KnownActionConfig> = {
  // https://github.com/biomejs/setup-biome
  'biomejs/setup-biome': {
    datasource: NpmDatasource.id,
    packageName: '@biomejs/biome',
  },
  // https://github.com/cloudflare/wrangler-action
  'cloudflare/wrangler-action': {
    datasource: NpmDatasource.id,
    packageName: 'wrangler',
    withSchema: valSchema('wranglerVersion'),
  },
  // https://github.com/cycjimmy/semantic-release-action
  'cycjimmy/semantic-release-action': {
    datasource: NpmDatasource.id,
    packageName: 'semantic-release',
    // the action's docs describe `semantic_version` as a version range, not
    // a pinned exact version
    versioning: npmVersioning.id,
    withSchema: valSchema('semantic_version'),
  },
  // https://github.com/azure/setup-helm
  'denoland/setup-deno': {
    datasource: NpmDatasource.id,
    packageName: 'deno',
    withSchema: valSchema('deno-version'),
  },
  // https://github.com/expo/expo-github-action
  'expo/expo-github-action': {
    datasource: NpmDatasource.id,
    packageName: 'eas-cli',
    withSchema: valSchema('eas-version'),
  },
  'jakebailey/pyright-action': {
    datasource: NpmDatasource.id,
    packageName: 'pyright',
    withSchema: valSchema('version', (val) => val === 'PATH'),
  },
  'oven-sh/setup-bun': {
    datasource: NpmDatasource.id,
    packageName: 'bun',
    withSchema: valSchema('bun-version'),
  },
  'pnpm/action-setup': {
    datasource: NpmDatasource.id,
    packageName: 'pnpm',
  },
  'supabase/setup-cli': {
    datasource: NpmDatasource.id,
    packageName: 'supabase',
  },
};
